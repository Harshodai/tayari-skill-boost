package concurrency

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"log"
	"sync"
	"time"

	"tayari-backend/internal/database"
)

// ... (existing code)

func (w *AuditWorker) workerLoop(id int) {
	defer w.wg.Done()
	for {
		select {
		case <-w.ctx.Done():
			return
		case job, ok := <-w.JobQueue:
			if !ok {
				return
			}
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
}
