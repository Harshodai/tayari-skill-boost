package models

import (
	"database/sql/driver"
	"encoding/json"
	"fmt"
	"strings"
	"time"
	"unicode"
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
	var b strings.Builder
	b.WriteByte('{')
	for i, v := range s {
		if i > 0 {
			b.WriteByte(',')
		}
		if needsQuoting(v) {
			b.WriteByte('"')
			b.WriteString(strings.ReplaceAll(strings.ReplaceAll(v, "\\", "\\\\"), "\"", "\\\""))
			b.WriteByte('"')
		} else {
			b.WriteString(v)
		}
	}
	b.WriteByte('}')
	return b.String(), nil
}

func needsQuoting(s string) bool {
	if s == "" {
		return true
	}
	for _, r := range s {
		if r == ' ' || r == ',' || r == '{' || r == '}' || r == '"' || r == '\\' {
			return true
		}
	}
	return false
}

func (s *StringSlice) Scan(value interface{}) error {
	if value == nil {
		*s = nil
		return nil
	}
	switch v := value.(type) {
	case []byte:
		if len(v) == 0 {
			*s = nil
			return nil
		}
		if v[0] == '[' {
			return json.Unmarshal(v, s)
		}
		*s = parsePostgresArray(string(v))
		return nil
	case string:
		if v == "" {
			*s = nil
			return nil
		}
		if v[0] == '[' {
			return json.Unmarshal([]byte(v), s)
		}
		*s = parsePostgresArray(v)
		return nil
	}
	return fmt.Errorf("cannot scan type %T into StringSlice", value)
}

// parsePostgresArray converts a PostgreSQL array literal like {a,"b c",d} to []string.
func parsePostgresArray(input string) []string {
	input = strings.TrimSpace(input)
	if len(input) < 2 || input[0] != '{' || input[len(input)-1] != '}' {
		return nil
	}
	inner := input[1 : len(input)-1]
	if inner == "" {
		return nil
	}
	var result []string
	var current strings.Builder
	inQuotes := false
	escaped := false
	for _, r := range inner {
		switch {
		case escaped:
			current.WriteRune(r)
			escaped = false
		case r == '\\':
			escaped = true
		case r == '"':
			inQuotes = !inQuotes
		case r == ',' && !inQuotes:
			result = append(result, strings.TrimSpace(current.String()))
			current.Reset()
		default:
			current.WriteRune(r)
		}
	}
	if current.Len() > 0 || len(result) > 0 {
		result = append(result, strings.TrimSpace(current.String()))
	}
	// Trim quotes from each element
	for i, s := range result {
		result[i] = strings.TrimFunc(s, func(r rune) bool { return r == '"' || unicode.IsSpace(r) })
	}
	return result
}
