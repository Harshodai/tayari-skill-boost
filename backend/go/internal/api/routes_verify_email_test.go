package api

import (
	"bytes"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"net/http"
	"net/http/httptest"
	"regexp"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/google/uuid"
	"tayari-backend/internal/config"
	dbwrap "tayari-backend/internal/database"
)

func TestVerifyEmailHandler(t *testing.T) {
	t.Run("EmptyToken_Returns400", func(t *testing.T) {
		server := NewServer(nil, &config.Config{JWTSecret: "test-secret-at-least-32-characters-long"}, &dbwrap.DB{Conn: nil})
		body := bytes.NewBufferString(`{"token":""}`)
		req := httptest.NewRequest(http.MethodPost, "/api/v1/auth/verify-email", body)
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()

		server.Router.ServeHTTP(w, req)
		if w.Code != http.StatusBadRequest {
			t.Fatalf("expected 400 Bad Request, got %d", w.Code)
		}
	})

	t.Run("InvalidToken_Returns400", func(t *testing.T) {
		sqlDB, mock, err := sqlmock.New()
		if err != nil {
			t.Fatalf("sqlmock.New: %v", err)
		}
		defer sqlDB.Close()

		server := NewServer(nil, &config.Config{JWTSecret: "test-secret-at-least-32-characters-long"}, &dbwrap.DB{Conn: sqlDB})

		token := "non-existent-token"
		hash := sha256.Sum256([]byte(token))
		tokenHash := hex.EncodeToString(hash[:])

		mock.ExpectQuery(regexp.QuoteMeta(`SELECT user_id, email, expires_at, used FROM email_verification_tokens WHERE token_hash = $1`)).
			WithArgs(tokenHash).
			WillReturnError(sql.ErrNoRows)

		body := bytes.NewBufferString(`{"token":"` + token + `"}`)
		req := httptest.NewRequest(http.MethodPost, "/api/v1/auth/verify-email", body)
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()

		server.Router.ServeHTTP(w, req)
		if w.Code != http.StatusBadRequest {
			t.Fatalf("expected 400 Bad Request, got %d: %s", w.Code, w.Body.String())
		}
	})

	t.Run("AlreadyUsedToken_Returns400", func(t *testing.T) {
		sqlDB, mock, err := sqlmock.New()
		if err != nil {
			t.Fatalf("sqlmock.New: %v", err)
		}
		defer sqlDB.Close()

		server := NewServer(nil, &config.Config{JWTSecret: "test-secret-at-least-32-characters-long"}, &dbwrap.DB{Conn: sqlDB})

		token := "already-used-token"
		hash := sha256.Sum256([]byte(token))
		tokenHash := hex.EncodeToString(hash[:])
		userID := uuid.New()

		mock.ExpectQuery(regexp.QuoteMeta(`SELECT user_id, email, expires_at, used FROM email_verification_tokens WHERE token_hash = $1`)).
			WithArgs(tokenHash).
			WillReturnRows(sqlmock.NewRows([]string{"user_id", "email", "expires_at", "used"}).
				AddRow(userID, "user@example.com", time.Now().Add(1*time.Hour), true))

		body := bytes.NewBufferString(`{"token":"` + token + `"}`)
		req := httptest.NewRequest(http.MethodPost, "/api/v1/auth/verify-email", body)
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()

		server.Router.ServeHTTP(w, req)
		if w.Code != http.StatusBadRequest {
			t.Fatalf("expected 400 Bad Request, got %d: %s", w.Code, w.Body.String())
		}
	})

	t.Run("ExpiredToken_Returns400", func(t *testing.T) {
		sqlDB, mock, err := sqlmock.New()
		if err != nil {
			t.Fatalf("sqlmock.New: %v", err)
		}
		defer sqlDB.Close()

		server := NewServer(nil, &config.Config{JWTSecret: "test-secret-at-least-32-characters-long"}, &dbwrap.DB{Conn: sqlDB})

		token := "expired-token"
		hash := sha256.Sum256([]byte(token))
		tokenHash := hex.EncodeToString(hash[:])
		userID := uuid.New()

		mock.ExpectQuery(regexp.QuoteMeta(`SELECT user_id, email, expires_at, used FROM email_verification_tokens WHERE token_hash = $1`)).
			WithArgs(tokenHash).
			WillReturnRows(sqlmock.NewRows([]string{"user_id", "email", "expires_at", "used"}).
				AddRow(userID, "user@example.com", time.Now().Add(-1*time.Hour), false))

		body := bytes.NewBufferString(`{"token":"` + token + `"}`)
		req := httptest.NewRequest(http.MethodPost, "/api/v1/auth/verify-email", body)
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()

		server.Router.ServeHTTP(w, req)
		if w.Code != http.StatusBadRequest {
			t.Fatalf("expected 400 Bad Request, got %d: %s", w.Code, w.Body.String())
		}
	})

	t.Run("ValidToken_Succeeds", func(t *testing.T) {
		sqlDB, mock, err := sqlmock.New()
		if err != nil {
			t.Fatalf("sqlmock.New: %v", err)
		}
		defer sqlDB.Close()

		server := NewServer(nil, &config.Config{JWTSecret: "test-secret-at-least-32-characters-long"}, &dbwrap.DB{Conn: sqlDB})

		token := "valid-verification-token"
		hash := sha256.Sum256([]byte(token))
		tokenHash := hex.EncodeToString(hash[:])
		userID := uuid.New()

		mock.ExpectQuery(regexp.QuoteMeta(`SELECT user_id, email, expires_at, used FROM email_verification_tokens WHERE token_hash = $1`)).
			WithArgs(tokenHash).
			WillReturnRows(sqlmock.NewRows([]string{"user_id", "email", "expires_at", "used"}).
				AddRow(userID, "user@example.com", time.Now().Add(1*time.Hour), false))

		mock.ExpectBegin()
		mock.ExpectExec(regexp.QuoteMeta(`UPDATE auth.users SET email_confirmed_at = NOW() WHERE id = $1`)).
			WithArgs(userID).
			WillReturnResult(sqlmock.NewResult(1, 1))
		mock.ExpectExec(regexp.QuoteMeta(`UPDATE email_verification_tokens SET used = true WHERE token_hash = $1`)).
			WithArgs(tokenHash).
			WillReturnResult(sqlmock.NewResult(1, 1))
		mock.ExpectCommit()

		body := bytes.NewBufferString(`{"token":"` + token + `"}`)
		req := httptest.NewRequest(http.MethodPost, "/api/v1/auth/verify-email", body)
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()

		server.Router.ServeHTTP(w, req)
		if w.Code != http.StatusOK {
			t.Fatalf("expected 200 OK, got %d: %s", w.Code, w.Body.String())
		}
	})
}

func TestResendVerificationEmailHandler(t *testing.T) {
	t.Run("EmptyEmail_Returns400", func(t *testing.T) {
		server := NewServer(nil, &config.Config{JWTSecret: "test-secret-at-least-32-characters-long"}, &dbwrap.DB{Conn: nil})

		body := bytes.NewBufferString(`{"email":""}`)
		req := httptest.NewRequest(http.MethodPost, "/api/v1/auth/resend-verification", body)
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()

		server.Router.ServeHTTP(w, req)
		if w.Code != http.StatusBadRequest {
			t.Fatalf("expected 400 Bad Request, got %d", w.Code)
		}
	})

	t.Run("UserNotFound_Returns200WithoutLeak", func(t *testing.T) {
		sqlDB, mock, err := sqlmock.New()
		if err != nil {
			t.Fatalf("sqlmock.New: %v", err)
		}
		defer sqlDB.Close()

		server := NewServer(nil, &config.Config{JWTSecret: "test-secret-at-least-32-characters-long"}, &dbwrap.DB{Conn: sqlDB})

		mock.ExpectQuery(regexp.QuoteMeta(`SELECT id FROM auth.users WHERE email = $1`)).
			WithArgs("unknown@example.com").
			WillReturnError(sql.ErrNoRows)

		body := bytes.NewBufferString(`{"email":"unknown@example.com"}`)
		req := httptest.NewRequest(http.MethodPost, "/api/v1/auth/resend-verification", body)
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()

		server.Router.ServeHTTP(w, req)
		if w.Code != http.StatusOK {
			t.Fatalf("expected 200 OK, got %d", w.Code)
		}
	})

	t.Run("ValidUser_InsertsTokenAndReturns200", func(t *testing.T) {
		sqlDB, mock, err := sqlmock.New()
		if err != nil {
			t.Fatalf("sqlmock.New: %v", err)
		}
		defer sqlDB.Close()

		server := NewServer(nil, &config.Config{JWTSecret: "test-secret-at-least-32-characters-long"}, &dbwrap.DB{Conn: sqlDB})

		userID := uuid.New()
		mock.ExpectQuery(regexp.QuoteMeta(`SELECT id FROM auth.users WHERE email = $1`)).
			WithArgs("known@example.com").
			WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(userID))

		mock.ExpectExec(regexp.QuoteMeta(`INSERT INTO email_verification_tokens (user_id, email, token_hash, expires_at)`)).
			WithArgs(userID, "known@example.com", sqlmock.AnyArg()).
			WillReturnResult(sqlmock.NewResult(1, 1))

		body := bytes.NewBufferString(`{"email":"known@example.com"}`)
		req := httptest.NewRequest(http.MethodPost, "/api/v1/auth/resend-verification", body)
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()

		server.Router.ServeHTTP(w, req)
		if w.Code != http.StatusOK {
			t.Fatalf("expected 200 OK, got %d: %s", w.Code, w.Body.String())
		}
	})
}
