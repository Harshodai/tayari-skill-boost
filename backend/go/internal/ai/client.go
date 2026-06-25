package ai

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"time"
)

// Client communicates with the Python AI service.
type Client struct {
	BaseURL string
	client  http.Client
}

// NewClient is a constructor for ai.Client
func NewClient(baseURL string) *Client {
	if baseURL == "" {
		baseURL = "http://localhost:8000"
	}
	return &Client{
		BaseURL: baseURL,
		client: http.Client{
			Timeout: 30 * time.Second,
		},
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

	req, err := http.NewRequest(http.MethodPost, c.BaseURL+"/api/v1/ats/analyze", &buf)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", w.FormDataContentType())
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
	payload := map[string]string{
		"resume_text":     resumeText,
		"job_description": jdText,
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequest(http.MethodPost, c.BaseURL+"/api/v1/ats/analyze", bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
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
	for k, v := range headers {
		req.Header.Set(k, v)
	}
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
	for k, v := range headers {
		req.Header.Set(k, v)
	}
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
	for k, v := range headers {
		req.Header.Set(k, v)
	}
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
