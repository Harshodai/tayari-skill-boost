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
					_ = task(ctx)
				}
			}
		}()
	}
}

// Submit enqueues a new task into the worker pool.
func (wp *WorkerPool) Submit(task Task) bool {
	select {
	case wp.taskQueue <- task:
		return true
	default:
		return false
	}
}

// Stop gracefully closes the task queue and waits for active workers to exit.
func (wp *WorkerPool) Stop() {
	close(wp.taskQueue)
	wp.wg.Wait()
}
