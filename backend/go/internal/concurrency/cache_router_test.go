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

func TestCacheRouterGetDeletesExpiredEntry(t *testing.T) {
	cache := NewCacheRouter()
	cache.Set("expired", "val", 50*time.Millisecond)
	cache.Set("valid", "val", time.Minute)

	time.Sleep(70 * time.Millisecond)

	if _, found := cache.Get("expired"); found {
		t.Errorf("Expected expired key to return a miss")
	}
	if len(cache.items) != 1 {
		t.Errorf("Expected expired entry to be lazily deleted, got %d items", len(cache.items))
	}

	if _, found := cache.Get("valid"); !found {
		t.Errorf("Expected valid key to remain readable")
	}
	if len(cache.items) != 1 {
		t.Errorf("Expected valid entry to be kept, got %d items", len(cache.items))
	}
}
