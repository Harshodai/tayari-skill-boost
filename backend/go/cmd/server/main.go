package main

import (
	"log"
	"net/http"
	"os"
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
	defer db.Close()

	// Init Concurrency Worker Pool for Audits
	auditWorker := concurrency.NewAuditWorker(db, 100)
	auditWorker.Start(5) // Start 5 concurrent workers

	var authService auth.AuthService
	if cfg.UseSupabase {
		log.Println("Using Supabase Authentication Strategy")
		authService = auth.NewSupabaseAuth(cfg)
	} else {
		log.Println("Using Local Postgres Authentication Strategy")

		authService = auth.NewLocalAuth(db, cfg, auditWorker)
	}

	server := api.NewServer(authService)

	log.Printf("Server starting on port %s", cfg.Port)
	if err := http.ListenAndServe(":"+cfg.Port, server.Router); err != nil {
		log.Fatalf("Server failed to start: %v", err)
	}
}
