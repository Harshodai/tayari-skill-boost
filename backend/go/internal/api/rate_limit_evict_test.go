package api

import (
	"fmt"
	"testing"
	"time"
)

func TestFallbackEvictsIdleKeysAfterWindow(t *testing.T) {
	now := time.Now()
	l := newPerUserAILimiterWithConfig(2, "", func() time.Time { return now })
	victimMs := now.UnixMilli()
	if ok, _ := l.fallbackAllow("victim", now); !ok {
		t.Fatal("first allowance must succeed")
	}
	if _, ok := l.fallback["victim"]; !ok {
		t.Fatal("victim key must exist after allowance")
	}
	_ = victimMs
	now = now.Add(2 * aiRateLimitWindow)
	for i := 0; i < fallbackMaxKeys+10; i++ {
		l.fallback[fmt.Sprintf("idle-%d", i)] = []int64{now.Add(-2 * aiRateLimitWindow).UnixMilli()}
	}
	if ok, _ := l.fallbackAllow("fresh-user", now); !ok {
		t.Fatal("fresh user must be allowed")
	}
	if _, ok := l.fallback["victim"]; ok {
		t.Fatal("idle victim key must be gone after window expiry + sweep")
	}
	if len(l.fallback) > fallbackMaxKeys+10 {
		t.Fatalf("sweep must bound map growth, got %d keys", len(l.fallback))
	}
}
