package concurrency

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"log"
	"sync"
	"time"

	"tayari-backend/internal/database"
)

// AuditLogJob defines the structure for audit log entries
type AuditLogJob struct {
	Action    string
	Success   bool
	Email     string
	Timestamp time.Time
	IPHash    string
}

// AuditWorker handles background processing of audit logs
type AuditWorker struct {
	DB       *database.DB
	JobQueue chan AuditLogJob
	ctx      context.Context
	cancel   context.CancelFunc
	wg       *sync.WaitGroup
}

// NewAuditWorker creates a new AuditWorker instance
func NewAuditWorker(db *database.DB, bufferSize int) *AuditWorker {
	ctx, cancel := context.WithCancel(context.Background())
	return &AuditWorker{
		DB:       db,
		JobQueue: make(chan AuditLogJob, bufferSize),
		ctx:      ctx,
		cancel:   cancel,
		wg:       &sync.WaitGroup{},
	}
}

// Start launches the specified number of worker goroutines
func (w *AuditWorker) Start(workerCount int) {
	for i := 0; i < workerCount; i++ {
		w.wg.Add(1)
		go w.workerLoop(i)
	}
}

// Stop gracefully shuts down the workers, ensuring all queued jobs are processed
func (w *AuditWorker) Stop() {
	// First close the channel to prevent new submissions
	close(w.JobQueue)
	// Wait for workers to drain the channel
	w.wg.Wait()
	// Finally cancel the context
	w.cancel()
}

func (w *AuditWorker) workerLoop(id int) {
	defer w.wg.Done()
	// Range over channel - automatically exits when channel is closed
	for job := range w.JobQueue {
		func() {
			ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			defer cancel()

			var err error
			if job.Action == "LOGIN_ATTEMPT" {
				// Hash email for privacy before DB storage
				emailHash := sha256.Sum256([]byte(job.Email))
				emailHashStr := hex.EncodeToString(emailHash[:])

				if !job.Success {
					// Upsert on email_hash conflict - increment attempt count
					_, err = w.DB.Conn.ExecContext(ctx,
						`INSERT INTO public.auth_attempts (email_hash, attempt_count, last_attempt_at, ip_hash) 
                     VALUES ($1, 1, $2, $3) 
                     ON CONFLICT (email_hash) DO UPDATE SET 
                        attempt_count = auth_attempts.attempt_count + 1, 
                        last_attempt_at = EXCLUDED.last_attempt_at,
                        ip_hash = EXCLUDED.ip_hash`,
						emailHashStr, job.Timestamp, job.IPHash,
					)
				} else {
					// On success, clear attempts for this email hash
					_, err = w.DB.Conn.ExecContext(ctx, "DELETE FROM public.auth_attempts WHERE email_hash = $1", emailHashStr)
				}
			}

			if err != nil {
				// Hash email for privacy in logs
				emailHash := sha256.Sum256([]byte(job.Email))
				emailHashStr := hex.EncodeToString(emailHash[:])
				log.Printf("[Worker %d] Failed to process audit log for hash:%s: %v", id, emailHashStr, err)
			}
		}()
	}
}
