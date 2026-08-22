package config

import "testing"

func TestValidateForStartupAllowsDevelopmentLocalAuth(t *testing.T) {
	cfg := &Config{Environment: "development", UseSupabase: false}
	if err := cfg.ValidateForStartup(); err != nil {
		t.Fatalf("development local auth should be allowed: %v", err)
	}
}

func TestValidateForStartupRejectsProductionLocalAuth(t *testing.T) {
	cfg := &Config{Environment: "production", UseSupabase: false}
	if err := cfg.ValidateForStartup(); err == nil {
		t.Fatal("production local auth must be rejected")
	}
}

func TestValidateForStartupRejectsStagingLocalhostOrigin(t *testing.T) {
	cfg := &Config{
		Environment:     "staging",
		UseSupabase:     true,
		SupabaseURL:     "https://staging.supabase.example",
		AIInternalToken: "internal-token",
		AllowedOrigins:  []string{"http://localhost:5173"},
	}
	if err := cfg.ValidateForStartup(); err == nil {
		t.Fatal("staging localhost origins must be rejected")
	}
}

func TestValidateForStartupRejectsE2ETestMode(t *testing.T) {
	t.Setenv("TAYARI_E2E_TEST_MODE", "true")
	cfg := &Config{
		Environment:     "production",
		UseSupabase:     true,
		SupabaseURL:     "https://prod.supabase.example",
		AIInternalToken: "internal-token",
		AllowedOrigins:  []string{"https://app.tayari.example"},
	}
	if err := cfg.ValidateForStartup(); err == nil {
		t.Fatal("production must reject TAYARI_E2E_TEST_MODE")
	}
}

func TestValidateForStartupAcceptsValidProductionConfig(t *testing.T) {
	cfg := &Config{
		Environment:     "production",
		UseSupabase:     true,
		SupabaseURL:     "https://prod.supabase.example",
		AIInternalToken: "internal-token",
		AllowedOrigins:  []string{"https://app.tayari.example"},
	}
	if err := cfg.ValidateForStartup(); err != nil {
		t.Fatalf("valid production configuration rejected: %v", err)
	}
}
