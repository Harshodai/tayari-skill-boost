package database

import (
	"context"
	"database/sql"
	"fmt"
	"log/slog"
	"time"

	_ "github.com/jackc/pgx/v5/stdlib" // Import pgx driver
)

// DB wraps the sql.DB connection
type DB struct {
	Conn *sql.DB
}

// NewDB creates a new database connection. maxOpenConns/maxIdleConns of 0 fall
// back to the package's own conservative defaults (see the call site comment
// in cmd/server/main.go for why these are configurable rather than fixed).
func NewDB(dsn string, maxOpenConns, maxIdleConns int) (*DB, error) {
	db, err := sql.Open("pgx", dsn)
	if err != nil {
		return nil, err
	}

	// database/sql defaults to an unbounded open-connection count (and only 2
	// idle), so a traffic spike degrades into unbounded Postgres connection
	// growth instead of requests queuing predictably at a known limit.
	if maxOpenConns <= 0 {
		maxOpenConns = 50
	}
	if maxIdleConns <= 0 {
		maxIdleConns = 25
	}
	db.SetMaxOpenConns(maxOpenConns)
	db.SetMaxIdleConns(maxIdleConns)
	db.SetConnMaxLifetime(30 * time.Minute)
	db.SetConnMaxIdleTime(5 * time.Minute)

	// Wait for DB to be ready
	pingCtx, pingCancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer pingCancel()

	if err := db.PingContext(pingCtx); err != nil {
		return nil, fmt.Errorf("failed to ping database: %w", err)
	}

	slog.Info("Connected to PostgreSQL successfully")
	dbInst := &DB{Conn: db}
	migCtx, migCancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer migCancel()
	if err := dbInst.RunMigrations(migCtx); err != nil {
		return nil, fmt.Errorf("failed to run database migrations: %w", err)
	}
	return dbInst, nil
}

// RunMigrations executes one-time database schema migrations during deployment.
func (db *DB) RunMigrations(ctx context.Context) error {
	migrations := []string{
		"UPDATE applications SET stage = status WHERE stage IS NULL",
	}
	for _, m := range migrations {
		if _, err := db.Conn.ExecContext(ctx, m); err != nil {
			return fmt.Errorf("migration failed (%s): %w", m, err)
		}
	}
	return nil
}

// Close closes the database connection
func (db *DB) Close() error {
	return db.Conn.Close()
}

// WithTenantTx executes fn within a transaction where request.jwt.claim.sub is set to userID.
func (db *DB) WithTenantTx(ctx context.Context, userID string, fn func(tx *sql.Tx) error) error {
	if userID == "" || isSyntheticIdentity(userID) {
		return fmt.Errorf("valid tenant userID required")
	}
	tx, err := db.Conn.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	// Set local session claim for RLS compatibility (is_local = true)
	if _, err := tx.ExecContext(ctx, "SELECT set_config('request.jwt.claim.sub', $1, true)", userID); err != nil {
		return fmt.Errorf("failed to set tenant claim: %w", err)
	}

	if err := fn(tx); err != nil {
		return err
	}
	return tx.Commit()
}

func isSyntheticIdentity(id string) bool {
	switch id {
	case "default_user", "candidate", "unknown", "anonymous", "system":
		return true
	default:
		return false
	}
}
