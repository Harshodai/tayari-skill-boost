package concurrency

import (
	"testing"
	"time"
)

func TestCacheRouter(t *testing.T) {
	cache := NewCacheRouter()

	cache.Set("key1", "val1", 500*time.Millisecond)

	val, found := cache.Get("key1")
	if !found || val != "val1" {
		t.Errorf("Expected val1, got %v (found: %v)", val, found)
	}

	// Wait for TTL expiration
	time.Sleep(600 * time.Millisecond)
	_, foundAfter := cache.Get("key1")
	if foundAfter {
		t.Errorf("Expected key1 to be expired and not found")
	}
}
