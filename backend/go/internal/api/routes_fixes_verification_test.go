package api

import (
	"bytes"
	"context"
	"net/http"
	"net/http/httptest"
	"regexp"
	"testing"
	"time"

	"tayari-backend/internal/auth"
	"tayari-backend/internal/capabilities"
	dbwrap "tayari-backend/internal/database"
	"tayari-backend/internal/models"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

func TestHandleListAutopilotRuns_PaginationAndBinding(t *testing.T) {
	tests := []struct {
		name         string
		queryString  string
		expectedLim  int
		expectedOff  int
	}{
		{
			name:        "default pagination when parameters omitted",
			queryString: "",
			expectedLim: 20,
			expectedOff: 0,
		},
		{
			name:        "custom valid limit and offset",
			queryString: "?limit=50&offset=100",
			expectedLim: 50,
			expectedOff: 100,
		},
		{
			name:        "limit capped at max 200",
			queryString: "?limit=999",
			expectedLim: 200,
			expectedOff: 0,
		},
		{
			name:        "offset capped at max 10000",
			queryString: "?offset=50000",
			expectedLim: 20,
			expectedOff: 10000,
		},
		{
			name:        "invalid negative and non-numeric values use safe defaults",
			queryString: "?limit=-10&offset=invalid",
			expectedLim: 20,
			expectedOff: 0,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			sqlDB, mock, err := sqlmock.New()
			if err != nil {
				t.Fatalf("sqlmock.New: %v", err)
			}
			defer sqlDB.Close()

			s := &Server{
				DB:           &dbwrap.DB{Conn: sqlDB},
				capabilities: capabilities.NewFromEnv(),
			}

			userID := "user-123"
			user := &models.User{ID: uuid.MustParse("11111111-1111-1111-1111-111111111111"), Email: "test@example.com"}

			req := httptest.NewRequest(http.MethodGet, "/api/v1/autopilot/runs"+tc.queryString, nil)
			ctx := context.WithValue(req.Context(), contextKeyUser, user)
			req = req.WithContext(ctx)
			rec := httptest.NewRecorder()

			expectedQueryPattern := regexp.QuoteMeta(`SELECT run_id, config, status, progress, current_step, logs, applications_created, error, created_at, updated_at
		FROM autopilot_runs
		WHERE user_id = $1
		ORDER BY created_at DESC LIMIT $2 OFFSET $3`)

			mock.ExpectQuery(expectedQueryPattern).
				WithArgs(user.ID, tc.expectedLim, tc.expectedOff).
				WillReturnRows(sqlmock.NewRows([]string{
					"run_id", "config", "status", "progress", "current_step", "logs", "applications_created", "error", "created_at", "updated_at",
				}))

			s.handleListAutopilotRuns(rec, req)

			if rec.Code != http.StatusOK {
				t.Fatalf("expected status 200, got %d: %s", rec.Code, rec.Body.String())
			}

			if err := mock.ExpectationsWereMet(); err != nil {
				t.Fatalf("unmet SQL expectations for %s: %v (user_id=%s, expected_limit=%d, expected_offset=%d)", tc.name, err, userID, tc.expectedLim, tc.expectedOff)
			}
		})
	}
}

func TestHandlePlanDecision_ApprovalSupersedesOtherPlans(t *testing.T) {
	t.Run("explicit version approval supersedes other proposed plans", func(t *testing.T) {
		sqlDB, mock, err := sqlmock.New()
		if err != nil {
			t.Fatalf("sqlmock.New: %v", err)
		}
		defer sqlDB.Close()

		s := &Server{
			DB:           &dbwrap.DB{Conn: sqlDB},
			capabilities: capabilities.NewFromEnv(),
		}

		taskUUID := uuid.New()
		userUUID := uuid.New()
		user := &models.User{ID: userUUID, Email: "user@example.com"}

		body := []byte(`{"plan_version": 1}`)
		req := httptest.NewRequest(http.MethodPost, "/api/v1/tasks/"+taskUUID.String()+"/plan/approve", bytes.NewReader(body))
		rctx := chi.NewRouteContext()
		rctx.URLParams.Add("taskID", taskUUID.String())
		req = req.WithContext(context.WithValue(req.Context(), chi.RouteCtxKey, rctx))
		req = req.WithContext(auth.WithUserContext(req.Context(), user))

		mock.ExpectBegin()
		// 1. Update specific proposed version to approved
		mock.ExpectExec(regexp.QuoteMeta(`UPDATE task_plans SET status=$3,approved_at=CASE WHEN $3='approved' THEN now() ELSE NULL END WHERE task_id=$1 AND user_id=$2 AND status='proposed' AND version=$4`)).
			WithArgs(taskUUID.String(), userUUID.String(), "approved", int64(1)).
			WillReturnResult(sqlmock.NewResult(1, 1))

		// 2. Supersede other proposed plans
		mock.ExpectExec(regexp.QuoteMeta(`UPDATE task_plans SET status='superseded' WHERE task_id=$1 AND user_id=$2 AND status='proposed'`)).
			WithArgs(taskUUID.String(), userUUID.String()).
			WillReturnResult(sqlmock.NewResult(0, 2))

		// 3. Update task_runs
		mock.ExpectExec(regexp.QuoteMeta(`UPDATE task_runs SET status=$3,version=version+1,updated_at=now() WHERE id=$1 AND user_id=$2`)).
			WithArgs(taskUUID.String(), userUUID.String(), "queued").
			WillReturnResult(sqlmock.NewResult(1, 1))

		// 4. Insert task_events
		mock.ExpectExec(regexp.QuoteMeta(`INSERT INTO task_events (task_id,user_id,event_type,payload) VALUES ($1,$2,$3,$4)`)).
			WithArgs(taskUUID.String(), userUUID.String(), "plan.approved", []byte(`{}`)).
			WillReturnResult(sqlmock.NewResult(1, 1))

		mock.ExpectCommit()

		// 5. writeTask query
		now := time.Now()
		mock.ExpectQuery(regexp.QuoteMeta(`SELECT id,title,objective,input_files,status,stop_requested_at,takeover_requested_at,version,created_at,updated_at FROM task_runs WHERE id=$1 AND user_id=$2`)).
			WithArgs(taskUUID.String(), userUUID.String()).
			WillReturnRows(sqlmock.NewRows([]string{
				"id", "title", "objective", "input_files", "status", "stop_requested_at", "takeover_requested_at", "version", "created_at", "updated_at",
			}).AddRow(taskUUID.String(), "Task Title", "Task Objective", []byte("[]"), "queued", nil, nil, int64(2), now, now))

		rec := httptest.NewRecorder()
		s.handleApproveTaskPlan(rec, req)

		if rec.Code != http.StatusOK {
			t.Fatalf("expected status 200, got %d: %s", rec.Code, rec.Body.String())
		}
		if err := mock.ExpectationsWereMet(); err != nil {
			t.Fatalf("unmet SQL expectations: %v", err)
		}
	})

	t.Run("default version approval approves latest proposed plan and supersedes other proposed plans", func(t *testing.T) {
		sqlDB, mock, err := sqlmock.New()
		if err != nil {
			t.Fatalf("sqlmock.New: %v", err)
		}
		defer sqlDB.Close()

		s := &Server{
			DB:           &dbwrap.DB{Conn: sqlDB},
			capabilities: capabilities.NewFromEnv(),
		}

		taskUUID := uuid.New()
		userUUID := uuid.New()
		user := &models.User{ID: userUUID, Email: "user@example.com"}

		req := httptest.NewRequest(http.MethodPost, "/api/v1/tasks/"+taskUUID.String()+"/plan/approve", nil)
		rctx := chi.NewRouteContext()
		rctx.URLParams.Add("taskID", taskUUID.String())
		req = req.WithContext(context.WithValue(req.Context(), chi.RouteCtxKey, rctx))
		req = req.WithContext(auth.WithUserContext(req.Context(), user))

		mock.ExpectBegin()
		// 1. Update latest proposed version to approved
		mock.ExpectExec(regexp.QuoteMeta(`UPDATE task_plans SET status=$3,approved_at=CASE WHEN $3='approved' THEN now() ELSE NULL END WHERE task_id=$1 AND user_id=$2 AND status='proposed' AND version=(SELECT MAX(version) FROM task_plans WHERE task_id=$1 AND user_id=$2)`)).
			WithArgs(taskUUID.String(), userUUID.String(), "approved").
			WillReturnResult(sqlmock.NewResult(1, 1))

		// 2. Supersede other proposed plans
		mock.ExpectExec(regexp.QuoteMeta(`UPDATE task_plans SET status='superseded' WHERE task_id=$1 AND user_id=$2 AND status='proposed'`)).
			WithArgs(taskUUID.String(), userUUID.String()).
			WillReturnResult(sqlmock.NewResult(0, 1))

		// 3. Update task_runs
		mock.ExpectExec(regexp.QuoteMeta(`UPDATE task_runs SET status=$3,version=version+1,updated_at=now() WHERE id=$1 AND user_id=$2`)).
			WithArgs(taskUUID.String(), userUUID.String(), "queued").
			WillReturnResult(sqlmock.NewResult(1, 1))

		// 4. Insert task_events
		mock.ExpectExec(regexp.QuoteMeta(`INSERT INTO task_events (task_id,user_id,event_type,payload) VALUES ($1,$2,$3,$4)`)).
			WithArgs(taskUUID.String(), userUUID.String(), "plan.approved", []byte(`{}`)).
			WillReturnResult(sqlmock.NewResult(1, 1))

		mock.ExpectCommit()

		// 5. writeTask query
		now := time.Now()
		mock.ExpectQuery(regexp.QuoteMeta(`SELECT id,title,objective,input_files,status,stop_requested_at,takeover_requested_at,version,created_at,updated_at FROM task_runs WHERE id=$1 AND user_id=$2`)).
			WithArgs(taskUUID.String(), userUUID.String()).
			WillReturnRows(sqlmock.NewRows([]string{
				"id", "title", "objective", "input_files", "status", "stop_requested_at", "takeover_requested_at", "version", "created_at", "updated_at",
			}).AddRow(taskUUID.String(), "Task Title", "Task Objective", []byte("[]"), "queued", nil, nil, int64(2), now, now))

		rec := httptest.NewRecorder()
		s.handleApproveTaskPlan(rec, req)

		if rec.Code != http.StatusOK {
			t.Fatalf("expected status 200, got %d: %s", rec.Code, rec.Body.String())
		}
		if err := mock.ExpectationsWereMet(); err != nil {
			t.Fatalf("unmet SQL expectations: %v", err)
		}
	})

	t.Run("plan rejection does not supersede other plans", func(t *testing.T) {
		sqlDB, mock, err := sqlmock.New()
		if err != nil {
			t.Fatalf("sqlmock.New: %v", err)
		}
		defer sqlDB.Close()

		s := &Server{
			DB:           &dbwrap.DB{Conn: sqlDB},
			capabilities: capabilities.NewFromEnv(),
		}

		taskUUID := uuid.New()
		userUUID := uuid.New()
		user := &models.User{ID: userUUID, Email: "user@example.com"}

		req := httptest.NewRequest(http.MethodPost, "/api/v1/tasks/"+taskUUID.String()+"/plan/reject", nil)
		rctx := chi.NewRouteContext()
		rctx.URLParams.Add("taskID", taskUUID.String())
		req = req.WithContext(context.WithValue(req.Context(), chi.RouteCtxKey, rctx))
		req = req.WithContext(auth.WithUserContext(req.Context(), user))

		mock.ExpectBegin()
		// 1. Update latest proposed version to rejected
		mock.ExpectExec(regexp.QuoteMeta(`UPDATE task_plans SET status=$3,approved_at=CASE WHEN $3='approved' THEN now() ELSE NULL END WHERE task_id=$1 AND user_id=$2 AND status='proposed' AND version=(SELECT MAX(version) FROM task_plans WHERE task_id=$1 AND user_id=$2)`)).
			WithArgs(taskUUID.String(), userUUID.String(), "rejected").
			WillReturnResult(sqlmock.NewResult(1, 1))

		// Note: no UPDATE ... SET status='superseded' query expected

		// 2. Update task_runs
		mock.ExpectExec(regexp.QuoteMeta(`UPDATE task_runs SET status=$3,version=version+1,updated_at=now() WHERE id=$1 AND user_id=$2`)).
			WithArgs(taskUUID.String(), userUUID.String(), "awaiting_plan_approval").
			WillReturnResult(sqlmock.NewResult(1, 1))

		// 3. Insert task_events
		mock.ExpectExec(regexp.QuoteMeta(`INSERT INTO task_events (task_id,user_id,event_type,payload) VALUES ($1,$2,$3,$4)`)).
			WithArgs(taskUUID.String(), userUUID.String(), "plan.rejected", []byte(`{}`)).
			WillReturnResult(sqlmock.NewResult(1, 1))

		mock.ExpectCommit()

		// 4. writeTask query
		now := time.Now()
		mock.ExpectQuery(regexp.QuoteMeta(`SELECT id,title,objective,input_files,status,stop_requested_at,takeover_requested_at,version,created_at,updated_at FROM task_runs WHERE id=$1 AND user_id=$2`)).
			WithArgs(taskUUID.String(), userUUID.String()).
			WillReturnRows(sqlmock.NewRows([]string{
				"id", "title", "objective", "input_files", "status", "stop_requested_at", "takeover_requested_at", "version", "created_at", "updated_at",
			}).AddRow(taskUUID.String(), "Task Title", "Task Objective", []byte("[]"), "awaiting_plan_approval", nil, nil, int64(2), now, now))

		rec := httptest.NewRecorder()
		s.handleRejectTaskPlan(rec, req)

		if rec.Code != http.StatusOK {
			t.Fatalf("expected status 200, got %d: %s", rec.Code, rec.Body.String())
		}
		if err := mock.ExpectationsWereMet(); err != nil {
			t.Fatalf("unmet SQL expectations: %v", err)
		}
	})
}

func TestHandleGetTaskPlan_OrderPrioritizesApprovedOverProposed(t *testing.T) {
	sqlDB, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New: %v", err)
	}
	defer sqlDB.Close()

	s := &Server{
		DB:           &dbwrap.DB{Conn: sqlDB},
		capabilities: capabilities.NewFromEnv(),
	}

	taskUUID := uuid.New()
	userUUID := uuid.New()
	user := &models.User{ID: userUUID, Email: "user@example.com"}

	req := httptest.NewRequest(http.MethodGet, "/api/v1/tasks/"+taskUUID.String()+"/plan", nil)
	rctx := chi.NewRouteContext()
	rctx.URLParams.Add("taskID", taskUUID.String())
	req = req.WithContext(context.WithValue(req.Context(), chi.RouteCtxKey, rctx))
	req = req.WithContext(auth.WithUserContext(req.Context(), user))

	expectedQuery := regexp.QuoteMeta(`SELECT task_id,version,steps,status,created_at,approved_at FROM task_plans WHERE task_id=$1 AND user_id=$2 ORDER BY CASE WHEN status='approved' THEN 1 WHEN status='proposed' THEN 2 ELSE 3 END, version DESC LIMIT 1`)

	now := time.Now()
	mock.ExpectQuery(expectedQuery).
		WithArgs(taskUUID.String(), userUUID.String()).
		WillReturnRows(sqlmock.NewRows([]string{
			"task_id", "version", "steps", "status", "created_at", "approved_at",
		}).AddRow(taskUUID.String(), int64(1), []byte("[]"), "approved", now, &now))

	rec := httptest.NewRecorder()
	s.handleGetTaskPlan(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d: %s", rec.Code, rec.Body.String())
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet SQL expectations: %v", err)
	}
}

func TestHandleListAdvisorStudents_RestrictsToStudentRole(t *testing.T) {
	t.Run("without cohort filter", func(t *testing.T) {
		sqlDB, mock, err := sqlmock.New()
		if err != nil {
			t.Fatalf("sqlmock.New: %v", err)
		}
		defer sqlDB.Close()

		s := &Server{
			DB:           &dbwrap.DB{Conn: sqlDB},
			capabilities: capabilities.NewFromEnv(),
		}

		advisorID := uuid.New()
		tenantID := uuid.New()
		advisor := &models.User{ID: advisorID}

		req := httptest.NewRequest(http.MethodGet, "/api/v1/advisor/students", nil)
		ctx := auth.WithUserContext(req.Context(), advisor)
		ctx = auth.WithAuthorizationContext(ctx, &auth.AuthorizationContext{
			Subject:  advisorID,
			TenantID: tenantID,
			Roles:    []string{"advisor"},
		})
		ctx = contextWithTenant(ctx, &models.Tenant{ID: tenantID})
		req = req.WithContext(ctx)

		// 1. checkAdvisorRole query
		mock.ExpectQuery(regexp.QuoteMeta(`SELECT role FROM memberships WHERE tenant_id = $1 AND user_id = $2`)).
			WithArgs(tenantID, advisorID).
			WillReturnRows(sqlmock.NewRows([]string{"role"}).AddRow("advisor"))

		// 2. handleListAdvisorStudents query must contain AND m.role = 'student'
		expectedStudentQuery := regexp.QuoteMeta(`SELECT
			u.id,
			COALESCE(p.full_name, '') as full_name,
			u.email,
			COALESCE(p.headline, '') as headline,
			m.cohort_id,
			COALESCE(c.name, 'Unassigned') as cohort_name,
			(SELECT COUNT(*) FROM resumes r WHERE r.user_id = u.id) as resume_count,
			(SELECT COALESCE(AVG(score), 0) FROM interview_scores iscore WHERE iscore.user_id = u.id) as avg_interview_score
		FROM auth.users u
		JOIN memberships m ON m.user_id = u.id
		LEFT JOIN profiles p ON p.id = u.id
		LEFT JOIN cohorts c ON c.id = m.cohort_id
		WHERE m.tenant_id = $1 AND m.role = 'student'
 ORDER BY COALESCE(p.full_name, '') ASC`)

		studentID := uuid.New()
		mock.ExpectQuery(expectedStudentQuery).
			WithArgs(tenantID).
			WillReturnRows(sqlmock.NewRows([]string{
				"id", "full_name", "email", "headline", "cohort_id", "cohort_name", "resume_count", "avg_interview_score",
			}).AddRow(studentID, "Alice Student", "student@example.com", "Software Engineer", nil, "Unassigned", 2, 88.5))

		rec := httptest.NewRecorder()
		s.handleListAdvisorStudents(rec, req)

		if rec.Code != http.StatusOK {
			t.Fatalf("expected status 200, got %d: %s", rec.Code, rec.Body.String())
		}
		if err := mock.ExpectationsWereMet(); err != nil {
			t.Fatalf("unmet SQL expectations: %v", err)
		}
	})

	t.Run("with cohort filter", func(t *testing.T) {
		sqlDB, mock, err := sqlmock.New()
		if err != nil {
			t.Fatalf("sqlmock.New: %v", err)
		}
		defer sqlDB.Close()

		s := &Server{
			DB:           &dbwrap.DB{Conn: sqlDB},
			capabilities: capabilities.NewFromEnv(),
		}

		advisorID := uuid.New()
		tenantID := uuid.New()
		cohortID := uuid.New()
		advisor := &models.User{ID: advisorID}

		req := httptest.NewRequest(http.MethodGet, "/api/v1/advisor/students?cohort_id="+cohortID.String(), nil)
		ctx := auth.WithUserContext(req.Context(), advisor)
		ctx = auth.WithAuthorizationContext(ctx, &auth.AuthorizationContext{
			Subject:  advisorID,
			TenantID: tenantID,
			Roles:    []string{"advisor"},
		})
		ctx = contextWithTenant(ctx, &models.Tenant{ID: tenantID})
		req = req.WithContext(ctx)

		mock.ExpectQuery(regexp.QuoteMeta(`SELECT role FROM memberships WHERE tenant_id = $1 AND user_id = $2`)).
			WithArgs(tenantID, advisorID).
			WillReturnRows(sqlmock.NewRows([]string{"role"}).AddRow("advisor"))

		expectedStudentQuery := regexp.QuoteMeta(`SELECT
			u.id,
			COALESCE(p.full_name, '') as full_name,
			u.email,
			COALESCE(p.headline, '') as headline,
			m.cohort_id,
			COALESCE(c.name, 'Unassigned') as cohort_name,
			(SELECT COUNT(*) FROM resumes r WHERE r.user_id = u.id) as resume_count,
			(SELECT COALESCE(AVG(score), 0) FROM interview_scores iscore WHERE iscore.user_id = u.id) as avg_interview_score
		FROM auth.users u
		JOIN memberships m ON m.user_id = u.id
		LEFT JOIN profiles p ON p.id = u.id
		LEFT JOIN cohorts c ON c.id = m.cohort_id
		WHERE m.tenant_id = $1 AND m.role = 'student' AND m.cohort_id = $2
 ORDER BY COALESCE(p.full_name, '') ASC`)

		studentID := uuid.New()
		cohortName := "Fall 2026"
		mock.ExpectQuery(expectedStudentQuery).
			WithArgs(tenantID, cohortID).
			WillReturnRows(sqlmock.NewRows([]string{
				"id", "full_name", "email", "headline", "cohort_id", "cohort_name", "resume_count", "avg_interview_score",
			}).AddRow(studentID, "Alice Student", "student@example.com", "Software Engineer", &cohortID, cohortName, 2, 88.5))

		rec := httptest.NewRecorder()
		s.handleListAdvisorStudents(rec, req)

		if rec.Code != http.StatusOK {
			t.Fatalf("expected status 200, got %d: %s", rec.Code, rec.Body.String())
		}
		if err := mock.ExpectationsWereMet(); err != nil {
			t.Fatalf("unmet SQL expectations: %v", err)
		}
	})
}
