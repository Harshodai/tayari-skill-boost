package ai

import (
	"errors"
	"sync"
	"time"
)

// ErrCircuitOpen is returned when the breaker is open. Callers map it to a
// structured degraded response instead of hanging on an unreachable engine.
var ErrCircuitOpen = errors.New("ai circuit breaker open")

// DegradedPayload is the truthful body served while the circuit is open.
func DegradedPayload() map[string]interface{} {
	return map[string]interface{}{"degraded": true, "reason": "ai_engine_unavailable"}
}

// IsCircuitOpen reports whether err is (or wraps) ErrCircuitOpen.
func IsCircuitOpen(err error) bool { return errors.Is(err, ErrCircuitOpen) }

type breakerState int

const (
	breakerClosed breakerState = iota
	breakerOpen
	breakerHalfOpen
)

// CircuitBreaker trips after threshold consecutive failures and stays open
// for cooldown, then lets one probe through (half-open).
type CircuitBreaker struct {
	mu        sync.Mutex
	state     breakerState
	failures  int
	openedAt  time.Time
	threshold int
	cooldown  time.Duration
	now       func() time.Time
}

// NewCircuitBreaker builds a breaker; a nil now uses time.Now.
// ponytail: injectable clock keeps the 30s half-open transition unit-testable
// without sleeping.
func NewCircuitBreaker(threshold int, cooldown time.Duration, now func() time.Time) *CircuitBreaker {
	if threshold < 1 {
		threshold = 1
	}
	if now == nil {
		now = time.Now
	}
	return &CircuitBreaker{threshold: threshold, cooldown: cooldown, now: now}
}

// BeforeCall returns false when the circuit is open (caller must fail fast).
func (b *CircuitBreaker) BeforeCall() bool {
	b.mu.Lock()
	defer b.mu.Unlock()
	switch b.state {
	case breakerOpen:
		if b.now().Sub(b.openedAt) >= b.cooldown {
			b.state = breakerHalfOpen
			return true
		}
		return false
	default:
		return true
	}
}

// AfterCall records the outcome; success resets, failure may trip the breaker.
func (b *CircuitBreaker) AfterCall(success bool) {
	b.mu.Lock()
	defer b.mu.Unlock()
	if success {
		b.failures = 0
		b.state = breakerClosed
		return
	}
	if b.state == breakerHalfOpen {
		b.state = breakerOpen
		b.openedAt = b.now()
		return
	}
	b.failures++
	if b.failures >= b.threshold {
		b.state = breakerOpen
		b.openedAt = b.now()
	}
}
