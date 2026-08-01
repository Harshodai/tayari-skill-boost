package concurrency

import (
	"context"
	"sync/atomic"
	"testing"
	"time"
)

func TestWorkerPoolExecution(t *testing.T) {
	wp := NewWorkerPool(4, 10)
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	wp.Start(ctx)

	var counter int64
	for i := 0; i < 5; i++ {
		ok := wp.Submit(func(ctx context.Context) error {
			atomic.AddInt64(&counter, 1)
			return nil
		})
		if !ok {
			t.Errorf("Failed to submit task %d", i)
		}
	}

	time.Sleep(100 * time.Millisecond)
	wp.Stop()

	if atomic.LoadInt64(&counter) != 5 {
		t.Errorf("Expected 5 completed tasks, got %d", atomic.LoadInt64(&counter))
	}
}
