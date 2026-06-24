package models

import (
	"time"

	"github.com/google/uuid"
)

type Tenant struct {
	ID             uuid.UUID `json:"id"`
	Name           string    `json:"name"`
	Domain         string    `json:"domain"`
	LogoURL        *string   `json:"logo_url"`
	PrimaryColor   string    `json:"primary_color"`
	SecondaryColor string    `json:"secondary_color"`
	CreatedAt      time.Time `json:"created_at"`
}

type Cohort struct {
	ID        int       `json:"id"`
	TenantID  uuid.UUID `json:"tenant_id"`
	Name      string    `json:"name"`
	CreatedAt time.Time `json:"created_at"`
}

type Membership struct {
	ID        int       `json:"id"`
	TenantID  uuid.UUID `json:"tenant_id"`
	UserID    uuid.UUID `json:"user_id"`
	Role      string    `json:"role"`
	CreatedAt time.Time `json:"created_at"`
}

type PushSubscription struct {
	ID        int       `json:"id"`
	UserID    uuid.UUID `json:"user_id"`
	Endpoint  string    `json:"endpoint"`
	P256dh    string    `json:"p256dh"`
	Auth      string    `json:"auth"`
	CreatedAt time.Time `json:"created_at"`
}
