package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"tayari-backend/internal/api"
	"tayari-backend/internal/auth"
	"tayari-backend/internal/concurrency"
	"tayari-backend/internal/config"
	"tayari-backend/internal/database"
)

const (
	maxDBRetries    = 5
	dbRetryInterval = 3 * time.Second
)

func main() {
	cfg := config.LoadConfig()

	// Init Social Auth Providers
	auth.SetupSocialAuth(cfg)

	// Connect to database with retry logic
	var db *database.DB
	var err error

	for i := 1; i <= maxDBRetries; i++ {
		db, err = database.NewDB(cfg.DatabaseURL)
		if err == nil {
			log.Println("Successfully connected to database")
			break
		}
		log.Printf("Database connection attempt %d/%d failed: %v", i, maxDBRetries, err)
		if i < maxDBRetries {
			log.Printf("Retrying in %v...", dbRetryInterval)
			time.Sleep(dbRetryInterval)
		}
	}

	if err != nil {
		log.Fatalf("Failed to connect to database after %d attempts: %v", maxDBRetries, err)
	}
	// db.Close() is handled in the graceful shutdown section

	// Init Concurrency Worker Pool for Audits
	auditWorker := concurrency.NewAuditWorker(db, 100)
	auditWorker.Start(5) // Start 5 concurrent workers

	var authService auth.AuthService
	if cfg.UseSupabase {
		log.Println("Using Supabase Authentication Strategy")
		authService = auth.NewSupabaseAuth(cfg, db)
	} else {
		log.Println("Using Local Postgres Authentication Strategy")

		authService = auth.NewLocalAuth(db, cfg, auditWorker)
	}

	server := api.NewServer(authService, cfg)

	srv := &http.Server{
		Addr:    ":" + cfg.Port,
		Handler: server.Router,
	}

	go func() {
		log.Printf("Server starting on port %s", cfg.Port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Server failed to start: %v", err)
		}
	}()

	// Graceful Shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, os.Interrupt, syscall.SIGTERM)
	<-quit

	log.Println("Shutting down server...")

	// Create a deadline to wait for.
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		log.Printf("Server forced to shutdown: %v", err)
	}

	// Stop workers
	auditWorker.Stop()

	// Close database
	if err := db.Close(); err != nil {
		log.Printf("Error closing database: %v", err)
	}

	log.Println("Server stopped gracefully")
}
