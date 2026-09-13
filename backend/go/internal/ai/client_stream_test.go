package ai

import (
	"testing"
	"time"
)

func TestStreamClientHasNoTimeout(t *testing.T) {
	c := NewClientWithToken("http://example.com", "tok")
	if c.streamClient.Timeout != 0 {
		t.Fatalf("stream client Timeout=%v, want 0 (SSE body reads must not die at 4min)", c.streamClient.Timeout)
	}
	if c.client.Timeout != 240*time.Second {
		t.Fatalf("JSON client Timeout=%v, want 240s", c.client.Timeout)
	}
}
