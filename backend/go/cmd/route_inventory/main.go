package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"

	"github.com/go-chi/chi/v5"

	"tayari-backend/internal/api"
	"tayari-backend/internal/config"
	"tayari-backend/internal/database"
)

type RouteInfo struct {
	Service       string `json:"service"`
	Method        string `json:"method"`
	Pattern       string `json:"pattern"`
	AuthProtected bool   `json:"auth_protected"`
	AuthType      string `json:"auth_type"` // "user_auth", "api_key", "internal_token", "none"
	StatusCode    int    `json:"unauth_status_code"`
}

func main() {
	outputPath := flag.String("o", "", "Output JSON file path (default stdout)")
	flag.Parse()

	// Suppress standard log output during route walk
	log.SetOutput(io.Discard)

	cfg := &config.Config{
		MetricsToken: "test-metrics-token",
	}
	srv := api.NewServer(nil, cfg, &database.DB{Conn: nil})

	var routes []RouteInfo

	err := chi.Walk(srv.Router, func(method, route string, handler http.Handler, middlewares ...func(http.Handler) http.Handler) error {
		// Clean up route pattern
		pattern := route
		if pattern == "" {
			pattern = "/"
		}

		// Create a synthetic unauthenticated request
		testPath := pattern
		// Replace URL parameters like {id}, {task_id}, {provider} with dummy values for testing
		for strings.Contains(testPath, "{") && strings.Contains(testPath, "}") {
			start := strings.Index(testPath, "{")
			end := strings.Index(testPath, "}")
			if start >= 0 && end > start {
				paramName := testPath[start+1 : end]
				dummyVal := "1"
				if strings.Contains(paramName, "provider") {
					dummyVal = "google"
				}
				testPath = testPath[:start] + dummyVal + testPath[end+1:]
			} else {
				break
			}
		}

		req := httptest.NewRequest(method, testPath, nil)
		rec := httptest.NewRecorder()
		srv.Router.ServeHTTP(rec, req)

		authType := "none"
		authProtected := false

		// Check response
		if rec.Code == http.StatusUnauthorized {
			body := rec.Body.String()
			if strings.Contains(body, "API key") {
				authType = "api_key"
				authProtected = true
			} else if strings.Contains(body, "internal token") || strings.Contains(body, "Internal") {
				authType = "internal_token"
				authProtected = true
			} else {
				authType = "user_auth"
				authProtected = true
			}
		} else if rec.Code == http.StatusForbidden {
			authType = "user_auth"
			authProtected = true
		}

		// Specific known routes
		if pattern == "/metrics" {
			authType = "internal_token"
			authProtected = true
		} else if strings.Contains(pattern, "/public/optimize") {
			authType = "api_key"
			authProtected = true
		}

		routes = append(routes, RouteInfo{
			Service:       "go-gateway",
			Method:        method,
			Pattern:       pattern,
			AuthProtected: authProtected,
			AuthType:      authType,
			StatusCode:    rec.Code,
		})
		return nil
	})

	if err != nil {
		fmt.Fprintf(os.Stderr, "Error walking chi router: %v\n", err)
		os.Exit(1)
	}

	var out io.Writer = os.Stdout
	if *outputPath != "" {
		f, err := os.Create(*outputPath)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error creating output file: %v\n", err)
			os.Exit(1)
		}
		defer f.Close()
		out = f
	}

	enc := json.NewEncoder(out)
	enc.SetIndent("", "  ")
	if err := enc.Encode(routes); err != nil {
		fmt.Fprintf(os.Stderr, "Error encoding JSON: %v\n", err)
		os.Exit(1)
	}
}
