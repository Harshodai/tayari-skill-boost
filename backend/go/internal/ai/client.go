package ai

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"net/url"
	"strings"
	"time"
)

// Client communicates with the Python AI service.
type Client struct {
	BaseURL       string
	internalToken string
	client        http.Client
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
	}
}

func (c *Client) setHeaders(req *http.Request, headers map[string]string) {
	for k, v := range headers {
		req.Header.Set(k, v)
	}
	if c.internalToken != "" {
		req.Header.Set("X-Internal-Token", c.internalToken)
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
	resp, err := c.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("AI service returned %d: %s", resp.StatusCode, string(body))
	}
	var result map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}
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
	resp, err := c.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("AI service returned %d: %s", resp.StatusCode, string(bodyBytes))
	}
	var result map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}
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
	resp, err := c.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("AI service returned %d: %s", resp.StatusCode, string(bodyBytes))
	}
	var result map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}
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
	resp, err := c.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("AI service returned %d: %s", resp.StatusCode, string(bodyBytes))
	}
	var result map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}
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
	resp, err := c.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("AI service returned %d: %s", resp.StatusCode, string(bodyBytes))
	}
	var result map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}
	return result, nil
}

func (c *Client) DeleteJSONWithHeaders(endpoint string, headers map[string]string) (map[string]interface{}, error) {
	req, err := http.NewRequest(http.MethodDelete, c.BaseURL+endpoint, nil)
	if err != nil {
		return nil, err
	}
	c.setHeaders(req, headers)
	resp, err := c.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("AI service returned %d: %s", resp.StatusCode, string(bodyBytes))
	}
	var result map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}
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
	resp, err := c.client.Do(req)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		resp.Body.Close()
		return nil, fmt.Errorf("AI service returned %d: %s", resp.StatusCode, string(bodyBytes))
	}
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
	resp, err := c.client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusNoContent {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("AI service returned %d: %s", resp.StatusCode, string(bodyBytes))
	}
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
	resp, err := c.client.Do(req)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		resp.Body.Close()
		return nil, fmt.Errorf("AI service returned %d: %s", resp.StatusCode, string(bodyBytes))
	}
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
	resp, err := c.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("AI service returned %d: %s", resp.StatusCode, string(bodyBytes))
	}
	var result map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}
	return result, nil
}
