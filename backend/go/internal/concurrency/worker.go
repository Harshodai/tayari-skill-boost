package concurrency

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"log"
	"time"

	"tayari-backend/internal/database"
)

// AuditLogJob represents a task to log an event
type AuditLogJob struct {
	Email     string
	Action    string
	Success   bool
	IPHash    string
	Timestamp time.Time
}

// AuditWorker handles background logging
type AuditWorker struct {
	JobQueue chan AuditLogJob
	DB       *database.DB
}

func NewAuditWorker(db *database.DB, bufferSize int) *AuditWorker {
	return &AuditWorker{
		JobQueue: make(chan AuditLogJob, bufferSize),
		DB:       db,
	}
}

// Start spawns the worker goroutines
func (w *AuditWorker) Start(workerCount int) {
	for i := 0; i < workerCount; i++ {
		go w.workerLoop(i)
	}
	log.Printf("Started %d audit log workers", workerCount)
}

func (w *AuditWorker) workerLoop(id int) {
	for job := range w.JobQueue {
		func() {
			ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			defer cancel()

			var err error
			if job.Action == "LOGIN_ATTEMPT" {
				if !job.Success {
					// Upsert on email conflict - increment attempt count
					_, err = w.DB.Conn.ExecContext(ctx,
						`INSERT INTO public.auth_attempts (email, attempt_count, last_attempt_at, ip_hash) 
                     VALUES ($1, 1, $2, $3) 
                     ON CONFLICT (email) DO UPDATE SET 
                        attempt_count = auth_attempts.attempt_count + 1, 
                        last_attempt_at = EXCLUDED.last_attempt_at,
                        ip_hash = EXCLUDED.ip_hash`,
						job.Email, job.Timestamp, job.IPHash,
					)
				} else {
					// On success, clear attempts for this email
					_, err = w.DB.Conn.ExecContext(ctx, "DELETE FROM public.auth_attempts WHERE email = $1", job.Email)
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
