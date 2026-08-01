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

	// Wait for DB to be ready
    ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
    defer cancel()
    
	if err := db.PingContext(ctx); err != nil {
		return nil, fmt.Errorf("failed to ping database: %w", err)
	}

	log.Println("Connected to PostgreSQL successfully")
	dbInst := &DB{Conn: db}
	if err := dbInst.RunMigrations(ctx); err != nil {
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
