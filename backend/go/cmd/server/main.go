package main

import (
	"context"
	"log"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/getsentry/sentry-go"

	"tayari-backend/internal/api"
	"tayari-backend/internal/auth"
	"tayari-backend/internal/concurrency"
	"tayari-backend/internal/config"
	"tayari-backend/internal/database"
	"tayari-backend/internal/observability"
)

const (
	maxDBRetries    = 5
	dbRetryInterval = 3 * time.Second
)

func main() {
	cfg := config.LoadConfig()
	if err := cfg.ValidateForStartup(); err != nil {
		log.Fatalf("FATAL: invalid startup configuration: %v", err)
	}

	shutdownTracer, tracerErr := observability.InitTracer(context.Background())
	if tracerErr != nil {
		slog.Warn("OTel init failed, tracing disabled", "error", tracerErr)
	} else {
		defer shutdownTracer()
	}

	if dsn := os.Getenv("SENTRY_DSN"); dsn != "" {
		err := sentry.Init(sentry.ClientOptions{
			Dsn:              dsn,
			Environment:      os.Getenv("SENTRY_ENVIRONMENT"),
			Release:          "tayari-backend@" + os.Getenv("APP_VERSION"),
			EnableTracing:    true,
			TracesSampleRate: 0.2,
		})
		if err != nil {
			slog.Error("Sentry init failed", "error", err)
		} else {
			slog.Info("Sentry initialized")
			defer sentry.Flush(2 * time.Second)
		}
	}

	// Init Social Auth Providers
	auth.SetupSocialAuth(cfg)

	// Connect to database with retry logic
	var db *database.DB
	var err error

	for i := 1; i <= maxDBRetries; i++ {
		db, err = database.NewDB(cfg.DatabaseURL, cfg.DBMaxOpenConns, cfg.DBMaxIdleConns)
		if err == nil {
			slog.Info("Successfully connected to database")
			break
		}
		slog.Error("Database connection attempt failed", "attempt", i, "max_attempts", maxDBRetries, "error", err)
		if i < maxDBRetries {
			slog.Info("Retrying in ...", "value", dbRetryInterval)
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
	defer auditWorker.Stop()

	var authService auth.AuthService
	// The Docker smoke suite intentionally exercises the Go gateway's direct
	// registration/login contract. TAYARI_E2E_TEST_MODE is rejected for
	// production startup by ValidateForStartup, so this cannot alter production
	// Supabase behavior or create a hidden auth bypass outside test mode.
	e2eLocalAuth := strings.EqualFold(strings.TrimSpace(os.Getenv("TAYARI_E2E_TEST_MODE")), "true")
	if cfg.UseSupabase && !e2eLocalAuth {
		slog.Info("Using Supabase Authentication Strategy")
		authService = auth.NewSupabaseAuth(cfg, db)
	} else {
		if cfg.UseSupabase {
			slog.Info("Using Local Postgres Authentication Strategy for E2E test mode")
		} else {
			slog.Info("Using Local Postgres Authentication Strategy")
		}
		authService = auth.NewLocalAuth(db, cfg, auditWorker)
	}

	server := api.NewServer(authService, cfg, db)

	srv := &http.Server{
		Addr:    ":" + cfg.Port,
		Handler: server.Handler(),
	}

	go func() {
		slog.Info("Server starting on port", "value", cfg.Port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Server failed to start: %v", err)
		}
	}()

	// Graceful Shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, os.Interrupt, syscall.SIGTERM)
	<-quit

	slog.Info("Shutting down server...")

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		slog.Error("Server forced to shutdown", "error", err)
	}

	slog.Info("Server stopped gracefully")
}
