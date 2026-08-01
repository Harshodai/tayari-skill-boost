package concurrency

import (
	"sync"
	"time"
)

type cacheItem struct {
	value      interface{}
	expiration time.Time
}

// CacheRouter implements a thread-safe Go memory cache with TTL expiration.
type CacheRouter struct {
	mu    sync.RWMutex
	items map[string]cacheItem
}

// NewCacheRouter creates a thread-safe cache router.
func NewCacheRouter() *CacheRouter {
	return &CacheRouter{
		items: make(map[string]cacheItem),
	}
}

// Set stores a key-value pair with TTL duration.
func (c *CacheRouter) Set(key string, value interface{}, ttl time.Duration) {
	c.mu.Lock()
	defer c.mu.Unlock()

	c.items[key] = cacheItem{
		value:      value,
		expiration: time.Now().Add(ttl),
	}
}

// Get retrieves a value if non-expired.
func (c *CacheRouter) Get(key string) (interface{}, bool) {
	c.mu.RLock()
	defer c.mu.RUnlock()

	item, found := c.items[key]
	if !found {
		return nil, false
	}

	if time.Now().After(item.expiration) {
		return nil, false
	}

	return item.value, true
}
