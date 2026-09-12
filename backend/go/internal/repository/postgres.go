package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
)

// setTenantClaim sets the RLS session claim for this transaction and
// propagates any failure to the caller.
//
// ponytail: every call site here used to do `_, _ = tx.ExecContext(...)`,
// silently discarding the error and letting the transaction proceed either
// way. Per this project's own documented RLS scope (see CLAUDE.md's "RLS
// scope" note), the `postgres` role this service connects as has BYPASSRLS,
// so RLS policies never evaluate for these connections regardless of
// whether this claim is set correctly — the real, load-bearing tenant
// isolation here is each query's own `WHERE user_id = $1`, unaffected by
// this call either way. So propagating the error doesn't newly protect
// against a cross-tenant leak on its own, but silently swallowing a real
// database error (a dead connection, a permissions problem) and continuing
// as if it succeeded is still wrong on general principle — errors should
// abort the transaction, not be discarded, especially on a call that
// exists specifically for defense-in-depth if this project ever completes
// the JWT-claims plumbing needed to make RLS actually apply to this role.
func setTenantClaim(ctx context.Context, tx *sql.Tx, userID string) error {
	if _, err := tx.ExecContext(ctx, "SELECT set_config('request.jwt.claim.sub', $1, true)", userID); err != nil {
		return fmt.Errorf("failed to set tenant RLS claim: %w", err)
	}
	return nil
}

// validateUserID ensures the userID is non-empty and not a synthetic identity.
func validateUserID(userID string) error {
	trimmed := strings.TrimSpace(userID)
	if trimmed == "" {
		return ErrInvalidUser
	}
	switch strings.ToLower(trimmed) {
	case "default_user", "candidate", "unknown", "anonymous", "system":
		return ErrInvalidUser
	default:
		return nil
	}
}

// -----------------------------------------------------------------------------
// PostgresResumeRepo
// -----------------------------------------------------------------------------

type PostgresResumeRepo struct {
	db *sql.DB
}

func NewPostgresResumeRepo(db *sql.DB) *PostgresResumeRepo {
	return &PostgresResumeRepo{db: db}
}

func (r *PostgresResumeRepo) Create(ctx context.Context, userID, title, text, fileType string) (int64, error) {
	if err := validateUserID(userID); err != nil {
		return 0, err
	}
	if strings.TrimSpace(title) == "" {
		return 0, errors.New("resume title is required")
	}

	query := `
		INSERT INTO resumes (user_id, title, original_text, file_type, status, created_at, updated_at)
		VALUES ($1, $2, $3, $4, 'uploaded', NOW(), NOW())
		RETURNING id
	`
	var id int64
	err := r.db.QueryRowContext(ctx, query, userID, title, text, fileType).Scan(&id)
	if err != nil {
		return 0, err
	}
	return id, nil
}

func (r *PostgresResumeRepo) GetByID(ctx context.Context, userID string, id int64) (*Resume, error) {
	if err := validateUserID(userID); err != nil {
		return nil, err
	}

	query := `
		SELECT id, user_id, title, COALESCE(original_text, ''), COALESCE(file_type, ''), status, created_at
		FROM resumes
		WHERE id = $1 AND user_id = $2
	`
	var res Resume
	err := r.db.QueryRowContext(ctx, query, id, userID).Scan(
		&res.ID,
		&res.UserID,
		&res.Title,
		&res.OriginalText,
		&res.FileType,
		&res.Status,
		&res.CreatedAt,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	return &res, nil
}

func (r *PostgresResumeRepo) ListByUser(ctx context.Context, userID string, limit int) ([]Resume, error) {
	if err := validateUserID(userID); err != nil {
		return nil, err
	}
	if limit <= 0 {
		limit = 50
	}

	query := `
		SELECT id, user_id, title, COALESCE(original_text, ''), COALESCE(file_type, ''), status, created_at
		FROM resumes
		WHERE user_id = $1
		ORDER BY created_at DESC
		LIMIT $2
	`
	rows, err := r.db.QueryContext(ctx, query, userID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var resumes []Resume
	for rows.Next() {
		var res Resume
		if err := rows.Scan(
			&res.ID,
			&res.UserID,
			&res.Title,
			&res.OriginalText,
			&res.FileType,
			&res.Status,
			&res.CreatedAt,
		); err != nil {
			return nil, err
		}
		resumes = append(resumes, res)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if resumes == nil {
		resumes = []Resume{}
	}
	return resumes, nil
}

func (r *PostgresResumeRepo) Update(ctx context.Context, userID string, id int64, title, text, fileType string) error {
	if err := validateUserID(userID); err != nil {
		return err
	}
	if strings.TrimSpace(title) == "" {
		return errors.New("resume title is required")
	}

	query := `
		UPDATE resumes
		SET title = $1, original_text = $2, file_type = $3, updated_at = NOW()
		WHERE id = $4 AND user_id = $5
	`
	res, err := r.db.ExecContext(ctx, query, title, text, fileType, id, userID)
	if err != nil {
		return err
	}
	rows, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if rows == 0 {
		return ErrNotFound
	}
	return nil
}

func (r *PostgresResumeRepo) Delete(ctx context.Context, userID string, id int64) error {
	if err := validateUserID(userID); err != nil {
		return err
	}

	query := `DELETE FROM resumes WHERE id = $1 AND user_id = $2`
	res, err := r.db.ExecContext(ctx, query, id, userID)
	if err != nil {
		return err
	}
	rows, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if rows == 0 {
		return ErrNotFound
	}
	return nil
}

// -----------------------------------------------------------------------------
// PostgresCoverLetterRepo
// -----------------------------------------------------------------------------

type PostgresCoverLetterRepo struct {
	db *sql.DB
}

func NewPostgresCoverLetterRepo(db *sql.DB) *PostgresCoverLetterRepo {
	return &PostgresCoverLetterRepo{db: db}
}

func (r *PostgresCoverLetterRepo) Create(ctx context.Context, cl *CoverLetter) (string, error) {
	if cl == nil {
		return "", errors.New("cover letter cannot be nil")
	}
	if err := validateUserID(cl.UserID); err != nil {
		return "", err
	}
	if strings.TrimSpace(cl.Body) == "" {
		return "", errors.New("cover letter body is required")
	}

	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return "", err
	}
	defer tx.Rollback()

	if err := setTenantClaim(ctx, tx, cl.UserID); err != nil {
		return "", err
	}

	var id string
	var createdAt time.Time
	if cl.ID != "" {
		query := `
			INSERT INTO cover_letters (id, user_id, job_title, company_name, content, created_at, updated_at)
			VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
			RETURNING id, created_at
		`
		err = tx.QueryRowContext(ctx, query, cl.ID, cl.UserID, cl.JobTitle, cl.Company, cl.Body).Scan(&id, &createdAt)
	} else {
		query := `
			INSERT INTO cover_letters (user_id, job_title, company_name, content, created_at, updated_at)
			VALUES ($1, $2, $3, $4, NOW(), NOW())
			RETURNING id, created_at
		`
		err = tx.QueryRowContext(ctx, query, cl.UserID, cl.JobTitle, cl.Company, cl.Body).Scan(&id, &createdAt)
	}
	if err != nil {
		return "", err
	}
	if err := tx.Commit(); err != nil {
		return "", err
	}

	cl.ID = id
	cl.CreatedAt = createdAt
	return id, nil
}

func (r *PostgresCoverLetterRepo) ListByUser(ctx context.Context, userID string) ([]CoverLetter, error) {
	if err := validateUserID(userID); err != nil {
		return nil, err
	}

	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	if err := setTenantClaim(ctx, tx, userID); err != nil {
		return nil, err
	}

	// ponytail: this query had no LIMIT at all — a user (or a script hitting
	// this endpoint) with enough cover letters could pull an unbounded
	// result set in one call. The frontend doesn't paginate this list today,
	// so a hard cap (rather than a breaking cursor/limit API change) closes
	// the unbounded-fetch risk without touching the response shape.
	query := `
		SELECT id, user_id, COALESCE(job_title, ''), COALESCE(company_name, ''), COALESCE(content, ''), created_at
		FROM cover_letters
		WHERE user_id = $1
		ORDER BY created_at DESC
		LIMIT 200
	`
	rows, err := tx.QueryContext(ctx, query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var letters []CoverLetter
	for rows.Next() {
		var cl CoverLetter
		if err := rows.Scan(
			&cl.ID,
			&cl.UserID,
			&cl.JobTitle,
			&cl.Company,
			&cl.Body,
			&cl.CreatedAt,
		); err != nil {
			return nil, err
		}
		letters = append(letters, cl)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if letters == nil {
		letters = []CoverLetter{}
	}
	return letters, tx.Commit()
}

func (r *PostgresCoverLetterRepo) Delete(ctx context.Context, userID, id string) error {
	if err := validateUserID(userID); err != nil {
		return err
	}
	if strings.TrimSpace(id) == "" {
		return errors.New("cover letter ID is required")
	}

	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	if err := setTenantClaim(ctx, tx, userID); err != nil {
		return err
	}

	query := `DELETE FROM cover_letters WHERE id = $1 AND user_id = $2`
	res, err := tx.ExecContext(ctx, query, id, userID)
	if err != nil {
		return err
	}
	rows, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if rows == 0 {
		return ErrNotFound
	}
	return tx.Commit()
}

// -----------------------------------------------------------------------------
// PostgresAppRepo
// -----------------------------------------------------------------------------

type PostgresAppRepo struct {
	db *sql.DB
}

func NewPostgresAppRepo(db *sql.DB) *PostgresAppRepo {
	return &PostgresAppRepo{db: db}
}

func (r *PostgresAppRepo) Create(ctx context.Context, app *Application) (int64, error) {
	if app == nil {
		return 0, errors.New("application cannot be nil")
	}
	if err := validateUserID(app.UserID); err != nil {
		return 0, err
	}
	stage := app.Stage
	if strings.TrimSpace(stage) == "" {
		stage = "saved"
	}

	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return 0, err
	}
	defer tx.Rollback()

	if err := setTenantClaim(ctx, tx, app.UserID); err != nil {
		return 0, err
	}

	appUUID := uuid.New().String()
	query := `
		INSERT INTO applications (application_id, user_id, company, title, job_url, apply_url, stage, status, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $5, $6, $6, NOW(), NOW())
		RETURNING id, created_at
	`
	var id int64
	var createdAt time.Time
	err = tx.QueryRowContext(ctx, query, appUUID, app.UserID, app.Company, app.JobTitle, app.JobURL, stage).Scan(&id, &createdAt)
	if err != nil {
		return 0, err
	}
	if err := tx.Commit(); err != nil {
		return 0, err
	}

	app.ID = id
	app.CreatedAt = createdAt
	return id, nil
}

func (r *PostgresAppRepo) GetByID(ctx context.Context, userID string, id int64) (*Application, error) {
	if err := validateUserID(userID); err != nil {
		return nil, err
	}

	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	if err := setTenantClaim(ctx, tx, userID); err != nil {
		return nil, err
	}

	query := `
		SELECT id, user_id, COALESCE(company, ''), COALESCE(title, ''), COALESCE(NULLIF(job_url, ''), COALESCE(apply_url, '')), COALESCE(NULLIF(stage, ''), COALESCE(status, 'saved')), created_at
		FROM applications
		WHERE id = $1 AND user_id = $2
	`
	var app Application
	err = tx.QueryRowContext(ctx, query, id, userID).Scan(
		&app.ID,
		&app.UserID,
		&app.Company,
		&app.JobTitle,
		&app.JobURL,
		&app.Stage,
		&app.CreatedAt,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	if err := tx.Commit(); err != nil {
		return nil, err
	}
	return &app, nil
}

func (r *PostgresAppRepo) ListByUser(ctx context.Context, userID string, limit, offset int) ([]Application, error) {
	if err := validateUserID(userID); err != nil {
		return nil, err
	}
	if limit <= 0 {
		limit = 50
	}
	if offset < 0 {
		offset = 0
	}

	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	if err := setTenantClaim(ctx, tx, userID); err != nil {
		return nil, err
	}

	query := `
		SELECT id, user_id, COALESCE(company, ''), COALESCE(title, ''), COALESCE(NULLIF(job_url, ''), COALESCE(apply_url, '')), COALESCE(NULLIF(stage, ''), COALESCE(status, 'saved')), created_at
		FROM applications
		WHERE user_id = $1
		ORDER BY created_at DESC
		LIMIT $2 OFFSET $3
	`
	rows, err := tx.QueryContext(ctx, query, userID, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var apps []Application
	for rows.Next() {
		var app Application
		if err := rows.Scan(
			&app.ID,
			&app.UserID,
			&app.Company,
			&app.JobTitle,
			&app.JobURL,
			&app.Stage,
			&app.CreatedAt,
		); err != nil {
			return nil, err
		}
		apps = append(apps, app)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if apps == nil {
		apps = []Application{}
	}
	return apps, tx.Commit()
}

func (r *PostgresAppRepo) UpdateStage(ctx context.Context, userID string, id int64, stage string) error {
	if err := validateUserID(userID); err != nil {
		return err
	}
	if strings.TrimSpace(stage) == "" {
		return errors.New("stage is required")
	}

	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	if err := setTenantClaim(ctx, tx, userID); err != nil {
		return err
	}

	query := `
		UPDATE applications
		SET stage = $1, status = $1, updated_at = NOW()
		WHERE id = $2 AND user_id = $3
	`
	res, err := tx.ExecContext(ctx, query, stage, id, userID)
	if err != nil {
		return err
	}
	rows, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if rows == 0 {
		return ErrNotFound
	}
	return tx.Commit()
}

// -----------------------------------------------------------------------------
// Factory
// -----------------------------------------------------------------------------

// NewPostgresRepositories wraps a SQL database connection into domain repository implementations.
func NewPostgresRepositories(db *sql.DB) *Repositories {
	if db == nil {
		return nil
	}
	return &Repositories{
		Resumes:      NewPostgresResumeRepo(db),
		CoverLetters: NewPostgresCoverLetterRepo(db),
		Applications: NewPostgresAppRepo(db),
	}
}
