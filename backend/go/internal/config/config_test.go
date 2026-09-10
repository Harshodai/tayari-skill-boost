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

func TestGetPythonAIURL(t *testing.T) {
	tests := []struct {
		name        string
		pythonAIURL string
		aiServURL   string
		expected    string
	}{
		{
			name:        "both unset defaults to localhost:8000",
			pythonAIURL: "",
			aiServURL:   "",
			expected:    "http://localhost:8000",
		},
		{
			name:        "AI_SERVICE_URL used when PYTHON_AI_URL is unset",
			pythonAIURL: "",
			aiServURL:   "http://python-lb:8000",
			expected:    "http://python-lb:8000",
		},
		{
			name:        "PYTHON_AI_URL takes precedence",
			pythonAIURL: "http://custom-ai:8000",
			aiServURL:   "http://python-lb:8000",
			expected:    "http://custom-ai:8000",
		},
		{
			name:        "trims whitespace and trailing slashes",
			pythonAIURL: "",
			aiServURL:   "  http://python-lb:8000/  ",
			expected:    "http://python-lb:8000",
		},
		{
			name:        "empty or whitespace string falls through",
			pythonAIURL: "   ",
			aiServURL:   "http://python-lb:8000",
			expected:    "http://python-lb:8000",
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Setenv("PYTHON_AI_URL", tc.pythonAIURL)
			t.Setenv("AI_SERVICE_URL", tc.aiServURL)
			got := getPythonAIURL()
			if got != tc.expected {
				t.Fatalf("expected %q, got %q", tc.expected, got)
			}
		})
	}
}
