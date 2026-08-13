package api

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestValidWaitlistEmail(t *testing.T) {
	cases := []struct {
		name  string
		email string
		want  bool
	}{
		{name: "valid", email: "pilot@example.com", want: true},
		{name: "display name rejected", email: "Pilot <pilot@example.com>", want: false},
		{name: "missing at sign", email: "pilot.example.com", want: false},
		{name: "extra at sign", email: "pilot@@example.com", want: false},
		{name: "blank", email: "", want: false},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := validWaitlistEmail(tc.email); got != tc.want {
				t.Fatalf("validWaitlistEmail(%q) = %v, want %v", tc.email, got, tc.want)
			}
		})
	}
}

func TestWaitlistJoinRejectsInvalidRequestsBeforeDatabaseAccess(t *testing.T) {
	s := &Server{}
	for _, body := range []string{
		`{"email":"not-an-email","tier":"institutions"}`,
		`{"email":"pilot@example.com","tier":"unsupported"}`,
		`{"email":"pilot@example.com","tier":"institutions","extra":true}`,
	} {
		req := httptest.NewRequest(http.MethodPost, "/api/v1/waitlist/join", bytes.NewBufferString(body))
		rec := httptest.NewRecorder()
		s.handleWaitlistJoin(rec, req)
		if rec.Code != http.StatusBadRequest {
			t.Fatalf("body %s: status = %d, want %d", body, rec.Code, http.StatusBadRequest)
		}
	}
}

func TestWaitlistJoinFailsClosedWhenDatabaseIsUnavailable(t *testing.T) {
	s := &Server{}
	req := httptest.NewRequest(http.MethodPost, "/api/v1/waitlist/join", bytes.NewBufferString(`{"email":"pilot@example.com","tier":"institutions"}`))
	rec := httptest.NewRecorder()
	s.handleWaitlistJoin(rec, req)
	if rec.Code != http.StatusServiceUnavailable {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusServiceUnavailable)
	}
}
