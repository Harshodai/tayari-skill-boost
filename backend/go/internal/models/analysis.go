package models

import (
	"database/sql/driver"
	"encoding/json"
	"fmt"
	"time"
)

// AnalysisResult stores the output of a resume vs JD analysis.
type AnalysisResult struct {
	ID               int         `json:"id"`
	UserID           string      `json:"user_id"`
	ResumeID         int         `json:"resume_id"`
	JobDescriptionID int         `json:"job_description_id"`
	Score            int         `json:"score"`
	Breakdown        JSONMap     `json:"breakdown,omitempty"`
	KeywordMatches   StringSlice `json:"keyword_matches,omitempty"`
	Recommendations  StringSlice `json:"recommendations,omitempty"`
	CreatedAt        time.Time   `json:"created_at"`
}

// JSONMap wraps map[string]interface{} for database storage.
type JSONMap map[string]interface{}

// Value implements driver.Valuer
func (j JSONMap) Value() (driver.Value, error) {
	if j == nil {
		return nil, nil
	}
	return json.Marshal(j)
}

// Scan implements sql.Scanner
func (j *JSONMap) Scan(value interface{}) error {
	if value == nil {
		*j = nil
		return nil
	}
	switch v := value.(type) {
	case []byte:
		return json.Unmarshal(v, j)
	case string:
		return json.Unmarshal([]byte(v), j)
	}
	return nil
}

// LogEntrySlice is a flexible JSON array that can hold strings or objects (log entries with step/message/at).
type LogEntrySlice []map[string]interface{}

func (l LogEntrySlice) Value() (driver.Value, error) {
	if l == nil {
		return nil, nil
	}
	return json.Marshal(l)
}

func (l *LogEntrySlice) Scan(value interface{}) error {
	if value == nil {
		*l = nil
		return nil
	}
	switch v := value.(type) {
	case []byte:
		return json.Unmarshal(v, l)
	case string:
		return json.Unmarshal([]byte(v), l)
	default:
		return fmt.Errorf("cannot scan type %T into LogEntrySlice", value)
	}
}

// StringSlice wraps a slice of strings for DB storage.
type StringSlice []string

func (s StringSlice) Value() (driver.Value, error) {
	if s == nil {
		return nil, nil
	}
	return json.Marshal(s)
}

func (s *StringSlice) Scan(value interface{}) error {
	if value == nil {
		*s = nil
		return nil
	}
	switch v := value.(type) {
	case []byte:
		return json.Unmarshal(v, s)
	case string:
		return json.Unmarshal([]byte(v), s)
	}
	return nil
}
