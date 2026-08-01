package concurrency

import (
	"testing"
	"time"
)

func TestRateLimiter(t *testing.T) {
	rl := NewRateLimiter(2, 1)

	// Consume 2 tokens
	if !rl.Allow() {
		t.Errorf("Expected token 1 to be allowed")
	}
	if !rl.Allow() {
		t.Errorf("Expected token 2 to be allowed")
	}

	// 3rd token should be denied immediately
	if rl.Allow() {
		t.Errorf("Expected token 3 to be denied")
	}

	// Wait for refill
	time.Sleep(1100 * time.Millisecond)
	if !rl.Allow() {
		t.Errorf("Expected refilled token to be allowed")
	}
}
