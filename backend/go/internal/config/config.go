package config

import (
	"fmt"
	"log"
	"os"
	"strings"
)

type Config struct {
	Environment            string
	Port                   string
	AllowedOrigins         []string
	CORSAllowedOrigins     []string
	DatabaseURL            string
	UseSupabase            bool
	JWTSecret              string
	SupabaseURL            string
	SupabaseKey            string
	SupabaseJWTIssuer      string
	SupabaseServiceRoleKey string
	FrontendURL            string
	PythonAIURL            string
	AIInternalToken        string
	MetricsToken           string

	// Social Auth Configs
	GoogleClientID     string
	GoogleClientSecret string
	GoogleCallbackURL  string

	GithubClientID     string
	GithubClientSecret string
	GithubCallbackURL  string

	LinkedinClientID     string
	LinkedinClientSecret string
	LinkedinCallbackURL  string
}

func LoadConfig() *Config {
	jwtSecret := getEnvRequired("JWT_SECRET")

	return &Config{
		Environment:        strings.ToLower(strings.TrimSpace(getEnv("APP_ENV", "development"))),
		Port:               getEnv("PORT", "8080"),
		AllowedOrigins:     parseAllowedOrigins(getEnv("ALLOWED_ORIGINS", "http://localhost:5173")),
		CORSAllowedOrigins: parseAllowedOrigins(getEnv("CORS_ALLOWED_ORIGINS", "")),
		DatabaseURL:        getEnv("DATABASE_URL", ""),
		UseSupabase:        getEnv("USE_SUPABASE", "false") == "true",
		JWTSecret:          jwtSecret,
		SupabaseURL:        getEnv("SUPABASE_URL", ""),
		SupabaseKey:        getEnv("SUPABASE_ANON_KEY", ""),
		SupabaseJWTIssuer:  getEnv("SUPABASE_JWT_ISSUER", ""),
		// Optional: enables the GoTrue Admin-API account-deletion path
		// (DELETE /auth/v1/admin/users/{id}) in handleDeleteAccount. Without
		// it, deletion falls back to a direct `DELETE FROM auth.users`.
		SupabaseServiceRoleKey: getEnv("SUPABASE_SERVICE_ROLE_KEY", ""),
		FrontendURL:            getEnv("FRONTEND_URL", "http://localhost:5173"),
		PythonAIURL:            getEnv("PYTHON_AI_URL", getEnv("AI_SERVICE_URL", "http://localhost:8000")),
		AIInternalToken:        getEnv("AI_INTERNAL_TOKEN", ""),
		MetricsToken:           getEnv("METRICS_TOKEN", getEnv("AI_INTERNAL_TOKEN", "")),

		GoogleClientID:     getEnv("GOOGLE_CLIENT_ID", ""),
		GoogleClientSecret: getEnv("GOOGLE_CLIENT_SECRET", ""),
		GoogleCallbackURL:  getEnv("GOOGLE_CALLBACK_URL", "http://localhost:8080/api/auth/google/callback"),

		GithubClientID:     getEnv("GITHUB_CLIENT_ID", ""),
		GithubClientSecret: getEnv("GITHUB_CLIENT_SECRET", ""),
		GithubCallbackURL:  getEnv("GITHUB_CALLBACK_URL", "http://localhost:8080/api/auth/github/callback"),

		LinkedinClientID:     getEnv("LINKEDIN_CLIENT_ID", ""),
		LinkedinClientSecret: getEnv("LINKEDIN_CLIENT_SECRET", ""),
		LinkedinCallbackURL:  getEnv("LINKEDIN_CALLBACK_URL", "http://localhost:8080/api/auth/linkedin/callback"),
	}
}

func (c *Config) ValidateForStartup() error {
	if c == nil {
		return fmt.Errorf("configuration is nil")
	}
	if c.Environment != "production" && c.Environment != "prod" && c.Environment != "staging" {
		return nil
	}
	if !c.UseSupabase {
		return fmt.Errorf("%s requires USE_SUPABASE=true; local authentication is development-only", c.Environment)
	}
	if strings.TrimSpace(c.SupabaseURL) == "" {
		return fmt.Errorf("%s requires SUPABASE_URL", c.Environment)
	}
	if strings.TrimSpace(c.AIInternalToken) == "" {
		return fmt.Errorf("%s requires AI_INTERNAL_TOKEN", c.Environment)
	}
	for _, origin := range append(append([]string{}, c.AllowedOrigins...), c.CORSAllowedOrigins...) {
		lower := strings.ToLower(strings.TrimSpace(origin))
		if strings.HasPrefix(lower, "http://localhost") || strings.HasPrefix(lower, "http://127.0.0.1") {
			return fmt.Errorf("%s cannot use localhost CORS origin: %s", c.Environment, origin)
		}
	}
	return nil
}

func getEnv(key, fallback string) string {
	if value, exists := os.LookupEnv(key); exists {
		return value
	}
	return fallback
}

// getEnvRequired panics if the environment variable is not set
// Use for security-critical values like JWT_SECRET
func getEnvRequired(key string) string {
	value, exists := os.LookupEnv(key)
	if !exists || value == "" {
		log.Fatalf("FATAL: Required environment variable %s is not set", key)
	}
	if key == "JWT_SECRET" {
		insecureDefaults := map[string]bool{
			"super-secret-key": true,
			"secret":           true,
			"change-me":        true,
			"your-jwt-secret":  true,
		}
		if insecureDefaults[strings.ToLower(strings.TrimSpace(value))] {
			appEnv := strings.ToLower(os.Getenv("APP_ENV"))
			if appEnv == "production" || appEnv == "staging" || appEnv == "prod" {
				log.Fatalf("FATAL: Insecure default JWT_SECRET detected in %s environment. Change JWT_SECRET immediately.", appEnv)
			} else {
				log.Printf("SECURITY WARNING: Using insecure default JWT_SECRET in %s mode. Do not use in production!", appEnv)
			}
		}
	}
	return value
}

// parseAllowedOrigins handles empty string case properly
func parseAllowedOrigins(s string) []string {
	if s == "" {
		return nil
	}
	origins := strings.Split(s, ",")
	// Filter out empty strings
	result := make([]string, 0, len(origins))
	for _, o := range origins {
		trimmed := strings.TrimSpace(o)
		if trimmed != "" {
			result = append(result, trimmed)
		}
	}
	return result
}
