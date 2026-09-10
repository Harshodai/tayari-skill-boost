package repository

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/google/uuid"
)

// MockResumeRepo is an in-memory implementation of ResumeRepository.
type MockResumeRepo struct {
	mu      sync.RWMutex
	resumes map[int64]Resume
	nextID  int64
}

func NewMockResumeRepo() *MockResumeRepo {
	return &MockResumeRepo{
		resumes: make(map[int64]Resume),
		nextID:  1,
	}
}

func (m *MockResumeRepo) Create(ctx context.Context, userID, title, text, fileType string) (int64, error) {
	if err := validateUserID(userID); err != nil {
		return 0, err
	}
	m.mu.Lock()
	defer m.mu.Unlock()

	id := m.nextID
	m.nextID++
	m.resumes[id] = Resume{
		ID:           id,
		UserID:       userID,
		Title:        title,
		OriginalText: text,
		FileType:     fileType,
		Status:       "uploaded",
		CreatedAt:    time.Now(),
	}
	return id, nil
}

func (m *MockResumeRepo) GetByID(ctx context.Context, userID string, id int64) (*Resume, error) {
	if err := validateUserID(userID); err != nil {
		return nil, err
	}
	m.mu.RLock()
	defer m.mu.RUnlock()

	res, ok := m.resumes[id]
	if !ok || res.UserID != userID {
		return nil, ErrNotFound
	}
	return &res, nil
}

func (m *MockResumeRepo) ListByUser(ctx context.Context, userID string, limit int) ([]Resume, error) {
	if err := validateUserID(userID); err != nil {
		return nil, err
	}
	m.mu.RLock()
	defer m.mu.RUnlock()

	var list []Resume
	for _, r := range m.resumes {
		if r.UserID == userID {
			list = append(list, r)
			if limit > 0 && len(list) >= limit {
				break
			}
		}
	}
	return list, nil
}

func (m *MockResumeRepo) Update(ctx context.Context, userID string, id int64, title, text, fileType string) error {
	if err := validateUserID(userID); err != nil {
		return err
	}
	m.mu.Lock()
	defer m.mu.Unlock()

	res, ok := m.resumes[id]
	if !ok || res.UserID != userID {
		return ErrNotFound
	}
	res.Title = title
	res.OriginalText = text
	res.FileType = fileType
	m.resumes[id] = res
	return nil
}

func (m *MockResumeRepo) Delete(ctx context.Context, userID string, id int64) error {
	if err := validateUserID(userID); err != nil {
		return err
	}
	m.mu.Lock()
	defer m.mu.Unlock()

	res, ok := m.resumes[id]
	if !ok || res.UserID != userID {
		return ErrNotFound
	}
	delete(m.resumes, id)
	return nil
}

// MockCoverLetterRepo is an in-memory implementation of CoverLetterRepository.
type MockCoverLetterRepo struct {
	mu      sync.RWMutex
	letters map[string]CoverLetter
}

func NewMockCoverLetterRepo() *MockCoverLetterRepo {
	return &MockCoverLetterRepo{
		letters: make(map[string]CoverLetter),
	}
}

func (m *MockCoverLetterRepo) Create(ctx context.Context, cl *CoverLetter) (string, error) {
	if cl == nil {
		return "", fmt.Errorf("cover letter cannot be nil")
	}
	if err := validateUserID(cl.UserID); err != nil {
		return "", err
	}
	m.mu.Lock()
	defer m.mu.Unlock()

	id := cl.ID
	if id == "" {
		id = uuid.New().String()
	}
	cl.ID = id
	cl.CreatedAt = time.Now()
	m.letters[id] = *cl
	return id, nil
}

func (m *MockCoverLetterRepo) ListByUser(ctx context.Context, userID string) ([]CoverLetter, error) {
	if err := validateUserID(userID); err != nil {
		return nil, err
	}
	m.mu.RLock()
	defer m.mu.RUnlock()

	var list []CoverLetter
	for _, l := range m.letters {
		if l.UserID == userID {
			list = append(list, l)
		}
	}
	return list, nil
}

func (m *MockCoverLetterRepo) Delete(ctx context.Context, userID, id string) error {
	if err := validateUserID(userID); err != nil {
		return err
	}
	m.mu.Lock()
	defer m.mu.Unlock()

	l, ok := m.letters[id]
	if !ok || l.UserID != userID {
		return ErrNotFound
	}
	delete(m.letters, id)
	return nil
}

// MockAppRepo is an in-memory implementation of ApplicationRepository.
type MockAppRepo struct {
	mu     sync.RWMutex
	apps   map[int64]Application
	nextID int64
}

func NewMockAppRepo() *MockAppRepo {
	return &MockAppRepo{
		apps:   make(map[int64]Application),
		nextID: 1,
	}
}

func (m *MockAppRepo) Create(ctx context.Context, app *Application) (int64, error) {
	if app == nil {
		return 0, fmt.Errorf("application cannot be nil")
	}
	if err := validateUserID(app.UserID); err != nil {
		return 0, err
	}
	m.mu.Lock()
	defer m.mu.Unlock()

	id := m.nextID
	m.nextID++
	app.ID = id
	app.CreatedAt = time.Now()
	if app.Stage == "" {
		app.Stage = "saved"
	}
	m.apps[id] = *app
	return id, nil
}

func (m *MockAppRepo) GetByID(ctx context.Context, userID string, id int64) (*Application, error) {
	if err := validateUserID(userID); err != nil {
		return nil, err
	}
	m.mu.RLock()
	defer m.mu.RUnlock()

	app, ok := m.apps[id]
	if !ok || app.UserID != userID {
		return nil, ErrNotFound
	}
	return &app, nil
}

func (m *MockAppRepo) ListByUser(ctx context.Context, userID string, limit, offset int) ([]Application, error) {
	if err := validateUserID(userID); err != nil {
		return nil, err
	}
	m.mu.RLock()
	defer m.mu.RUnlock()

	var all []Application
	for _, a := range m.apps {
		if a.UserID == userID {
			all = append(all, a)
		}
	}
	if offset > len(all) {
		return []Application{}, nil
	}
	end := len(all)
	if limit > 0 && offset+limit < end {
		end = offset + limit
	}
	return all[offset:end], nil
}

func (m *MockAppRepo) UpdateStage(ctx context.Context, userID string, id int64, stage string) error {
	if err := validateUserID(userID); err != nil {
		return err
	}
	m.mu.Lock()
	defer m.mu.Unlock()

	app, ok := m.apps[id]
	if !ok || app.UserID != userID {
		return ErrNotFound
	}
	app.Stage = stage
	m.apps[id] = app
	return nil
}

// NewMockRepositories returns an in-memory test suite of repositories.
func NewMockRepositories() *Repositories {
	return &Repositories{
		Resumes:      NewMockResumeRepo(),
		CoverLetters: NewMockCoverLetterRepo(),
		Applications: NewMockAppRepo(),
	}
}
