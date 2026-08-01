package concurrency

import (
	"context"
	"errors"
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

func TestWorkerPoolReportsTaskErrors(t *testing.T) {
	wp := NewWorkerPool(1, 4)
	reported := make(chan error, 3)
	wp.OnError = func(err error) { reported <- err }

	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	wp.Start(ctx)

	want := errors.New("boom")
	for i := 0; i < 3; i++ {
		if !wp.Submit(func(ctx context.Context) error { return want }) {
			t.Fatal("Failed to submit task")
		}
	}
	wp.Stop()

	for i := 0; i < 3; i++ {
		select {
		case err := <-reported:
			if err != want {
				t.Errorf("Expected error %v, got %v", want, err)
			}
		case <-time.After(2 * time.Second):
			t.Fatal("Task error was not reported to OnError")
		}
	}
}

func TestWorkerPoolSubmitAfterStopReturnsFalse(t *testing.T) {
	wp := NewWorkerPool(2, 4)
	wp.Stop()
	if wp.Submit(func(ctx context.Context) error { return nil }) {
		t.Error("Expected Submit after Stop to return false")
	}
}

func TestWorkerPoolStopIsIdempotent(t *testing.T) {
	wp := NewWorkerPool(2, 4)
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	wp.Start(ctx)
	wp.Stop()
	wp.Stop()
}
