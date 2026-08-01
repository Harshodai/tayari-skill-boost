package concurrency

import (
	"context"
	"sync"
)

// Task represents a unit of work for the Go worker pool.
type Task func(ctx context.Context) error

// WorkerPool manages parallel execution of tasks with channel pipelines.
type WorkerPool struct {
	concurrency int
	taskQueue   chan Task
	wg          sync.WaitGroup
	mu          sync.Mutex
	closed      bool

	// OnError receives each non-nil error returned by a task.
	// It is read once at Start; set it before calling Start.
	OnError func(error)
}

// NewWorkerPool instantiates a worker pool with specified concurrency.
func NewWorkerPool(concurrency int, queueSize int) *WorkerPool {
	if concurrency <= 0 {
		concurrency = 4
	}
	if queueSize <= 0 {
		queueSize = 100
	}
	return &WorkerPool{
		concurrency: concurrency,
		taskQueue:   make(chan Task, queueSize),
	}
}

// Start launches the worker pool goroutines.
func (wp *WorkerPool) Start(ctx context.Context) {
	// ponytail: snapshot OnError once so a caller mutating the field after
	// Start cannot race the workers reading it.
	onError := wp.OnError
	for i := 0; i < wp.concurrency; i++ {
		wp.wg.Add(1)
		go func() {
			defer wp.wg.Done()
			for {
				select {
				case <-ctx.Done():
					return
				case task, ok := <-wp.taskQueue:
					if !ok {
						return
					}
					if err := task(ctx); err != nil && onError != nil {
						onError(err)
					}
				}
			}
		}()
	}
}

// Submit enqueues a new task into the worker pool.
func (wp *WorkerPool) Submit(task Task) bool {
	wp.mu.Lock()
	defer wp.mu.Unlock()
	if wp.closed {
		return false
	}
	// ponytail: nonblocking send under the lock — the closed-check and the
	// enqueue stay atomic (no send on a closed channel), and since the send
	// never blocks, holding the mutex across it cannot deadlock.
	select {
	case wp.taskQueue <- task:
		return true
	default:
		return false
	}
}

// Stop gracefully closes the task queue and waits for active workers to exit.
func (wp *WorkerPool) Stop() {
	wp.mu.Lock()
	if !wp.closed {
		wp.closed = true
		close(wp.taskQueue)
	}
	wp.mu.Unlock()
	wp.wg.Wait()
}
