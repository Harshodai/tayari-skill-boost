package database

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"time"

	_ "github.com/jackc/pgx/v5/stdlib" // Import pgx driver
)

// DB wraps the sql.DB connection
type DB struct {
	Conn *sql.DB
}

// NewDB creates a new database connection
func NewDB(dsn string) (*DB, error) {
	db, err := sql.Open("pgx", dsn)
	if err != nil {
		return nil, err
	}

	// database/sql defaults to an unbounded open-connection count (and only 2
	// idle), so a traffic spike degrades into unbounded Postgres connection
	// growth instead of requests queuing predictably at a known limit. The Go
	// gateway is a thin auth/routing layer in front of the Python AI engine,
	// not a heavy DB consumer, so these are deliberately modest starting
	// values, not a load-tested ceiling.
	db.SetMaxOpenConns(10)
	db.SetMaxIdleConns(5)
	db.SetConnMaxLifetime(30 * time.Minute)

	// Wait for DB to be ready
	pingCtx, pingCancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer pingCancel()

	if err := db.PingContext(pingCtx); err != nil {
		return nil, fmt.Errorf("failed to ping database: %w", err)
	}

	log.Println("Connected to PostgreSQL successfully")
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
