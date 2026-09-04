package api

import (
	"context"
	"io"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

type closeTrackingReader struct {
	r      io.Reader
	closed chan struct{}
	once   chan struct{}
}

func newCloseTrackingReader(r io.Reader) *closeTrackingReader {
	return &closeTrackingReader{r: r, closed: make(chan struct{}), once: make(chan struct{}, 1)}
}

func (c *closeTrackingReader) Read(p []byte) (int, error) { return c.r.Read(p) }
func (c *closeTrackingReader) Close() error {
	select {
	case c.once <- struct{}{}:
		close(c.closed)
	default:
	}
	return nil
}

func TestProxyComputerStream_ClosesUpstreamOnCancel(t *testing.T) {
	pr, pw := io.Pipe()
	src := newCloseTrackingReader(pr)
	req := httptest.NewRequest("GET", "/stream", nil)
	ctx, cancel := context.WithCancel(req.Context())
	req = req.WithContext(ctx)
	w := httptest.NewRecorder()
	done := make(chan struct{})
	go func() {
		defer close(done)
		proxyComputerStream(req, w, src)
	}()
	cancel()
	_ = pw.Close()
	select {
	case <-done:
	case <-time.After(2 * time.Second):
		t.Fatal("proxyComputerStream did not return promptly on cancel")
	}
	select {
	case <-src.closed:
	case <-time.After(2 * time.Second):
		t.Fatal("upstream body was not closed on exit path")
	}
}

func TestProxyComputerStream_ReturnsPromptlyOnCancel(t *testing.T) {
	body := strings.Repeat("data: x\n\n", 1000)
	src := newCloseTrackingReader(strings.NewReader(body))
	req := httptest.NewRequest("GET", "/stream", nil)
	ctx, cancel := context.WithCancel(req.Context())
	cancel()
	req = req.WithContext(ctx)
	w := httptest.NewRecorder()
	done := make(chan struct{})
	go func() {
		defer close(done)
		proxyComputerStream(req, w, src)
	}()
	select {
	case <-done:
	case <-time.After(2 * time.Second):
		t.Fatal("handler did not return promptly with canceled context")
	}
}
