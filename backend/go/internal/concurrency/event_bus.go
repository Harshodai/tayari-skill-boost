package concurrency

import (
	"sync"
)

// EventHandler is a callback function for processing topic events.
type EventHandler func(data interface{})

// EventBus manages topic-based pub/sub message dispatching in Go.
type EventBus struct {
	mu          sync.RWMutex
	subscribers map[string][]EventHandler
}

// NewEventBus creates a thread-safe Go event bus.
func NewEventBus() *EventBus {
	return &EventBus{
		subscribers: make(map[string][]EventHandler),
	}
}

// Subscribe registers a handler function for a specific topic.
func (eb *EventBus) Subscribe(topic string, handler EventHandler) {
	eb.mu.Lock()
	defer eb.mu.Unlock()

	eb.subscribers[topic] = append(eb.subscribers[topic], handler)
}

// Publish dispatches data to all subscribers of a topic concurrently.
func (eb *EventBus) Publish(topic string, data interface{}) {
	eb.mu.RLock()
	handlers, found := eb.subscribers[topic]
	eb.mu.RUnlock()

	if !found {
		return
	}

	var wg sync.WaitGroup
	for _, handler := range handlers {
		wg.Add(1)
		h := handler
		go func() {
			defer wg.Done()
			h(data)
		}()
	}
	wg.Wait()
}
