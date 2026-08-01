package concurrency

import (
	"sync/atomic"
	"testing"
)

func TestEventBus(t *testing.T) {
	eb := NewEventBus()

	var count int64
	eb.Subscribe("job.created", func(data interface{}) {
		atomic.AddInt64(&count, 1)
	})

	eb.Publish("job.created", "JobPayload1")
	eb.Publish("job.created", "JobPayload2")

	if atomic.LoadInt64(&count) != 2 {
		t.Errorf("Expected 2 events received, got %d", atomic.LoadInt64(&count))
	}
}

func TestEventBusRecoversPanickingSubscriber(t *testing.T) {
	eb := NewEventBus()

	var count int64
	eb.Subscribe("job.created", func(data interface{}) {
		panic("subscriber boom")
	})
	eb.Subscribe("job.created", func(data interface{}) {
		atomic.AddInt64(&count, 1)
	})

	func() {
		defer func() {
			if r := recover(); r != nil {
				t.Errorf("Publish panicked: %v", r)
			}
		}()
		eb.Publish("job.created", "JobPayload1")
	}()

	if atomic.LoadInt64(&count) != 1 {
		t.Errorf("Expected second subscriber to receive event, got %d", atomic.LoadInt64(&count))
	}
}
