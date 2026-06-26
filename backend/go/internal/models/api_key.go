package models

import "time"

type ApiKey struct {
	ID          int64      `json:"id"`
	UserID      string     `json:"user_id"`
	Name        string     `json:"name"`
	KeyPrefix   string     `json:"key_prefix"`
	KeyHash     string     `json:"-"`
	IsActive    bool       `json:"is_active"`
	RateLimit   int        `json:"rate_limit"`
	CreatedAt   time.Time  `json:"created_at"`
	LastUsedAt  *time.Time `json:"last_used_at,omitempty"`
}

type ApiUsage struct {
	ID         int64     `json:"id"`
	ApiKeyID   int64     `json:"api_key_id"`
	Endpoint   string    `json:"endpoint"`
	StatusCode int       `json:"status_code"`
	IPAddress  string    `json:"ip_address,omitempty"`
	ResponseMs int       `json:"response_ms,omitempty"`
	CreatedAt  time.Time `json:"created_at"`
}
