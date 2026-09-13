package ai

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"net/url"
	"strings"
	"time"
)

// APIError preserves the Python service's real HTTP status code and response
// body. A client-caused 4xx (bad request, validation failure, not found) is
// not the same fact as the service being unreachable — callers that blanket
// every error into 502 "service unavailable" mask an actionable, correct
// error behind a false "the backend is down" claim. Callers that want the
// real status can `errors.As(err, &apiErr)`; callers that don't change
// nothing, since Error() renders identically to the old untyped message.
type APIError struct {
	StatusCode int
	Body       string
}

func (e *APIError) Error() string {
	return fmt.Sprintf("AI service returned %d: %s", e.StatusCode, e.Body)
}

// Client communicates with the Python AI service.
type Client struct {
	BaseURL       string
	internalToken string
	client        http.Client
	streamClient  http.Client
	breaker       *CircuitBreaker
}

// NewClient is kept for callers that only need an unauthenticated health client.
func NewClient(baseURL string) *Client {
	return NewClientWithToken(baseURL, "")
}

// NewClientWithToken authenticates every Go-to-Python request with a private
// service token. User identity headers remain caller-specific and are applied
// after this helper, while the internal token cannot be overridden by callers.
func NewClientWithToken(baseURL, internalToken string) *Client {
	if baseURL == "" {
		baseURL = "http://localhost:8000"
	}
	return &Client{
		BaseURL:       baseURL,
		internalToken: internalToken,
		client: http.Client{
			// 240s: the resume optimizer runs a 2-call reflection loop
			// (optimize + re-prompt) against whatever LLM is configured —
			// a free-tier/shared-capacity model can push past 120s total,
			// which was silently 502ing every optimize call under that
			// condition (verified live: OpenRouter free-tier google/gemma
			// completions, 2m0s "context deadline exceeded" in go-backend
			// logs while python-ai was still working).
			Timeout: 240 * time.Second,
		},
		// ponytail: http.Client.Timeout covers full body reads, so the
		// 240s client kills SSE streams at 4min despite a 20min ctx and
		// the 600s worker timeout. Streams use this deadline-free client
		// instead — caller ctx (disconnect/deadline) still aborts them.
		streamClient: http.Client{},
		breaker:      NewCircuitBreaker(3, 30*time.Second, nil),
	}
}

// SetBreaker swaps the circuit breaker, allowing tests to inject a test clock.
func (c *Client) SetBreaker(b *CircuitBreaker) {
	c.breaker = b
}

// blocked fast-fails when the breaker is open so callers never hang on a
// dead engine. HealthCheck intentionally bypasses this: it is the liveness
// signal, not proxied traffic.
func (c *Client) blocked() bool {
	return c != nil && c.breaker != nil && !c.breaker.BeforeCall()
}

// ponytail: a Python 4xx proves the engine is reachable, so only transport
// errors and 5xx count toward the breaker; client bugs must not trip it.
func isBreakerFailure(err error) bool {
	if err == nil {
		return false
	}
	var apiErr *APIError
	if errors.As(err, &apiErr) {
		return apiErr.StatusCode >= 500
	}
	return true
}

func (c *Client) record(err error) {
	if c == nil || c.breaker == nil {
		return
	}
	c.breaker.AfterCall(!isBreakerFailure(err))
}

// SetTransport overrides the internal HTTP transport, allowing in-memory mocking in tests.
func (c *Client) SetTransport(rt http.RoundTripper) {
	c.client.Transport = rt
	c.streamClient.Transport = rt
}

func (c *Client) setHeaders(req *http.Request, headers map[string]string) {
	for k, v := range headers {
		req.Header.Set(k, v)
	}
	if c.internalToken != "" {
		req.Header.Set("X-Internal-Token", c.internalToken)
	}
	if req.Header.Get("X-Request-ID") == "" {
		req.Header.Set("X-Request-ID", fmt.Sprintf("req-%d", time.Now().UnixNano()))
	}
}

// ParseDocument sends a file to the Python service for parsing.
func (c *Client) ParseDocument(fileData []byte, fileType string) (map[string]interface{}, error) {
	var buf bytes.Buffer
	w := multipart.NewWriter(&buf)
	part, err := w.CreateFormFile("resume_file", "resume."+fileType)
	if err != nil {
		return nil, err
	}
	part.Write(fileData)
	w.Close()

	req, err := http.NewRequest(http.MethodPost, c.BaseURL+"/api/v1/parser/parse", &buf)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", w.FormDataContentType())
	c.setHeaders(req, nil)
	if c.blocked() {
		return nil, ErrCircuitOpen
	}
	resp, err := c.client.Do(req)
	if err != nil {
		c.record(err)
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		apiErr := &APIError{StatusCode: resp.StatusCode, Body: string(body)}
		c.record(apiErr)
		return nil, apiErr
	}
	var result map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		// ponytail: corrupt payload after HTTP 200 proves reachability — skip breaker record either way.
		return nil, err
	}
	c.record(nil)
	return result, nil
}

// AnalyzeResume sends resume + JD text for full analysis.
func (c *Client) AnalyzeResume(resumeText, jdText string) (map[string]interface{}, error) {
	data := url.Values{}
	data.Set("resume_text", resumeText)
	data.Set("job_description", jdText)

	req, err := http.NewRequest(http.MethodPost, c.BaseURL+"/api/v1/ats/analyze", strings.NewReader(data.Encode()))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	c.setHeaders(req, nil)
	if c.blocked() {
		return nil, ErrCircuitOpen
	}
	resp, err := c.client.Do(req)
	if err != nil {
		c.record(err)
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		apiErr := &APIError{StatusCode: resp.StatusCode, Body: string(bodyBytes)}
		c.record(apiErr)
		return nil, apiErr
	}
	var result map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		// ponytail: corrupt payload after HTTP 200 proves reachability — skip breaker record either way.
		return nil, err
	}
	c.record(nil)
	return result, nil
}

func (c *Client) PostJSON(endpoint string, payload interface{}) (map[string]interface{}, error) {
	return c.PostJSONWithHeaders(endpoint, payload, nil)
}

func (c *Client) PostJSONWithHeaders(endpoint string, payload interface{}, headers map[string]string) (map[string]interface{}, error) {
	body, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}
	req, err := http.NewRequest(http.MethodPost, c.BaseURL+endpoint, bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	c.setHeaders(req, headers)
	if c.blocked() {
		return nil, ErrCircuitOpen
	}
	resp, err := c.client.Do(req)
	if err != nil {
		c.record(err)
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode < http.StatusOK || resp.StatusCode >= http.StatusMultipleChoices {
		bodyBytes, _ := io.ReadAll(resp.Body)
		apiErr := &APIError{StatusCode: resp.StatusCode, Body: string(bodyBytes)}
		c.record(apiErr)
		return nil, apiErr
	}
	var result map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		// ponytail: corrupt payload after HTTP 200 proves reachability — skip breaker record either way.
		return nil, err
	}
	c.record(nil)
	return result, nil
}

func (c *Client) PutJSONWithHeaders(endpoint string, payload interface{}, headers map[string]string) (map[string]interface{}, error) {
	body, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}
	req, err := http.NewRequest(http.MethodPut, c.BaseURL+endpoint, bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	c.setHeaders(req, headers)
	if c.blocked() {
		return nil, ErrCircuitOpen
	}
	resp, err := c.client.Do(req)
	if err != nil {
		c.record(err)
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		apiErr := &APIError{StatusCode: resp.StatusCode, Body: string(bodyBytes)}
		c.record(apiErr)
		return nil, apiErr
	}
	var result map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		// ponytail: corrupt payload after HTTP 200 proves reachability — skip breaker record either way.
		return nil, err
	}
	c.record(nil)
	return result, nil
}

func (c *Client) PatchJSONWithHeaders(endpoint string, payload interface{}, headers map[string]string) (map[string]interface{}, error) {
	body, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}
	req, err := http.NewRequest(http.MethodPatch, c.BaseURL+endpoint, bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	c.setHeaders(req, headers)
	if c.blocked() {
		return nil, ErrCircuitOpen
	}
	resp, err := c.client.Do(req)
	if err != nil {
		c.record(err)
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		apiErr := &APIError{StatusCode: resp.StatusCode, Body: string(bodyBytes)}
		c.record(apiErr)
		return nil, apiErr
	}
	var result map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		// ponytail: corrupt payload after HTTP 200 proves reachability — skip breaker record either way.
		return nil, err
	}
	c.record(nil)
	return result, nil
}

func (c *Client) GetJSON(endpoint string) (map[string]interface{}, error) {
	return c.GetJSONWithHeaders(endpoint, nil)
}

func (c *Client) GetJSONWithHeaders(endpoint string, headers map[string]string) (map[string]interface{}, error) {
	req, err := http.NewRequest(http.MethodGet, c.BaseURL+endpoint, nil)
	if err != nil {
		return nil, err
	}
	c.setHeaders(req, headers)
	if c.blocked() {
		return nil, ErrCircuitOpen
	}
	resp, err := c.client.Do(req)
	if err != nil {
		c.record(err)
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		apiErr := &APIError{StatusCode: resp.StatusCode, Body: string(bodyBytes)}
		c.record(apiErr)
		return nil, apiErr
	}
	var result map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		// ponytail: corrupt payload after HTTP 200 proves reachability — skip breaker record either way.
		return nil, err
	}
	c.record(nil)
	return result, nil
}

func (c *Client) DeleteJSONWithHeaders(endpoint string, headers map[string]string) (map[string]interface{}, error) {
	req, err := http.NewRequest(http.MethodDelete, c.BaseURL+endpoint, nil)
	if err != nil {
		return nil, err
	}
	c.setHeaders(req, headers)
	if c.blocked() {
		return nil, ErrCircuitOpen
	}
	resp, err := c.client.Do(req)
	if err != nil {
		c.record(err)
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		apiErr := &APIError{StatusCode: resp.StatusCode, Body: string(bodyBytes)}
		c.record(apiErr)
		return nil, apiErr
	}
	var result map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		// ponytail: corrupt payload after HTTP 200 proves reachability — skip breaker record either way.
		return nil, err
	}
	c.record(nil)
	return result, nil
}

// GetBlob performs a GET and returns the raw response body plus headers,
// for endpoints that stream files (e.g. resume-graph JSON export). Callers
// are responsible for closing the returned body.
func (c *Client) GetBlob(endpoint string, headers map[string]string) (*http.Response, error) {
	req, err := http.NewRequest(http.MethodGet, c.BaseURL+endpoint, nil)
	if err != nil {
		return nil, err
	}
	c.setHeaders(req, headers)
	if c.blocked() {
		return nil, ErrCircuitOpen
	}
	resp, err := c.streamClient.Do(req)
	if err != nil {
		c.record(err)
		return nil, err
	}
	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		resp.Body.Close()
		apiErr := &APIError{StatusCode: resp.StatusCode, Body: string(bodyBytes)}
		c.record(apiErr)
		return nil, apiErr
	}
	c.record(nil)
	return resp, nil
}

// DeleteNoContent performs a DELETE and succeeds on 200 or 204 (the statuses
// used for resource deletion). Returns an error otherwise.
func (c *Client) DeleteNoContent(endpoint string, headers map[string]string) error {
	req, err := http.NewRequest(http.MethodDelete, c.BaseURL+endpoint, nil)
	if err != nil {
		return err
	}
	c.setHeaders(req, headers)
	if c.blocked() {
		return ErrCircuitOpen
	}
	resp, err := c.client.Do(req)
	if err != nil {
		c.record(err)
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusNoContent {
		bodyBytes, _ := io.ReadAll(resp.Body)
		apiErr := &APIError{StatusCode: resp.StatusCode, Body: string(bodyBytes)}
		c.record(apiErr)
		return apiErr
	}
	c.record(nil)
	return nil
}

func (c *Client) HealthCheck() error {
	resp, err := c.client.Get(c.BaseURL + "/health")
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("AI service health check failed: %d", resp.StatusCode)
	}
	return nil
}

// PostStream POSTs a JSON payload and returns the raw streaming response
// body for SSE passthrough. The caller owns closing the body. The request is
// bound to ctx so caller cancellation propagates upstream.
func (c *Client) PostStream(ctx context.Context, endpoint string, payload interface{}, headers map[string]string) (*http.Response, error) {
	body, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.BaseURL+endpoint, bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	c.setHeaders(req, headers)
	if c.blocked() {
		return nil, ErrCircuitOpen
	}
	resp, err := c.streamClient.Do(req)
	if err != nil {
		c.record(err)
		return nil, err
	}
	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		resp.Body.Close()
		apiErr := &APIError{StatusCode: resp.StatusCode, Body: string(bodyBytes)}
		c.record(apiErr)
		return nil, apiErr
	}
	c.record(nil)
	return resp, nil
}

// PostMultipartStream POSTs a pre-encoded multipart body and returns the raw
// streaming response for SSE passthrough. Uses the deadline-free stream
// client so long streams survive; ctx carries the caller deadline. The
// caller owns closing the body.
func (c *Client) PostMultipartStream(ctx context.Context, endpoint string, body io.Reader, contentType string, headers map[string]string) (*http.Response, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.BaseURL+endpoint, body)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", contentType)
	c.setHeaders(req, headers)
	if c.blocked() {
		return nil, ErrCircuitOpen
	}
	resp, err := c.streamClient.Do(req)
	if err != nil {
		c.record(err)
		return nil, err
	}
	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		resp.Body.Close()
		apiErr := &APIError{StatusCode: resp.StatusCode, Body: string(bodyBytes)}
		c.record(apiErr)
		return nil, apiErr
	}
	c.record(nil)
	return resp, nil
}

// PostJSONWithContext is PostJSONWithHeaders bound to a caller context so a
// per-request deadline (or client disconnect) aborts the upstream call.
func (c *Client) PostJSONWithContext(ctx context.Context, endpoint string, payload interface{}, headers map[string]string) (map[string]interface{}, error) {
	body, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.BaseURL+endpoint, bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	c.setHeaders(req, headers)
	if c.blocked() {
		return nil, ErrCircuitOpen
	}
	resp, err := c.client.Do(req)
	if err != nil {
		c.record(err)
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode < http.StatusOK || resp.StatusCode >= http.StatusMultipleChoices {
		bodyBytes, _ := io.ReadAll(resp.Body)
		apiErr := &APIError{StatusCode: resp.StatusCode, Body: string(bodyBytes)}
		c.record(apiErr)
		return nil, apiErr
	}
	var result map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		// ponytail: corrupt payload after HTTP 200 proves reachability — skip breaker record either way.
		return nil, err
	}
	c.record(nil)
	return result, nil
}

// PurgeUserRuntime asks the private AI engine to revoke user-owned browser,
// worker, Redis-budget, and process-local runtime state before account deletion.
func (c *Client) PurgeUserRuntime(ctx context.Context, userID string) error {
	_, err := c.PostJSONWithContext(
		ctx,
		"/api/v1/internal/account/purge",
		map[string]string{"user_id": userID},
		nil,
	)
	return err
}
