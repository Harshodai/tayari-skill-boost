package concurrency

import (
	"sync"
	"time"
)

// RateLimiter implements a thread-safe token bucket rate limiter in Go.
type RateLimiter struct {
	mu         sync.Mutex
	capacity   int
	tokens     int
	refillRate int // tokens per second
	lastRefill time.Time
}

// NewRateLimiter creates a token bucket rate limiter.
func NewRateLimiter(capacity int, refillRate int) *RateLimiter {
	return &RateLimiter{
		capacity:   capacity,
		tokens:     capacity,
		refillRate: refillRate,
		lastRefill: time.Now(),
	}
}

// Allow checks if a token is available and consumes it.
func (rl *RateLimiter) Allow() bool {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	now := time.Now()
	elapsed := now.Sub(rl.lastRefill).Seconds()
	rl.tokens += int(elapsed * float64(rl.refillRate))
	if rl.tokens > rl.capacity {
		rl.tokens = rl.capacity
	}
	rl.lastRefill = now

	if rl.tokens >= 1 {
		rl.tokens--
		return true
	}
	return false
}
