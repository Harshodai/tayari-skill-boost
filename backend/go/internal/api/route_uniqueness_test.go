package api

import (
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"testing"
)

// TestNoDuplicateRouteRegistrations statically scans every route registration
// call (r.Get/Post/Put/Delete/Patch) across internal/api/*.go and fails if the
// same (method, pattern) pair is registered more than once anywhere in the
// package.
//
// Why this exists: chi doesn't error on a duplicate GET/POST/... pattern — it
// silently lets the LAST registration win. A real production bug shipped this
// way: routes_agents.go and routes_automations.go both registered
// r.Get("/api/v1/approvals", ...) with two unrelated handlers and response
// shapes. Nothing caught it — not go build, not go vet, not chi.Walk (which
// only reports the winning handler per node, so it can't see the shadowed
// one), not any existing test. ReviewQueue.tsx, AgentPanel.tsx, and
// src/api/autopilot.ts were silently reading the wrong handler's response
// shape for an unknown period before this was found by manual investigation.
// This test makes that whole bug class a required, automatic check instead
// of something that only a human ruthlessly re-reading route files finds.
//
// This is intentionally a static source scan, not a chi.Walk assertion on a
// built router: chi.Walk only sees the tree AFTER duplicate resolution
// (last-registration-wins), so it structurally cannot detect the collision
// this test exists to catch.
func TestNoDuplicateRouteRegistrations(t *testing.T) {
	dir := "."
	entries, err := os.ReadDir(dir)
	if err != nil {
		t.Fatalf("failed to read internal/api directory: %v", err)
	}

	// method -> normalized full pattern -> list of "file:line" occurrences
	seen := make(map[string]map[string][]string)
	routeCall := regexp.MustCompile(`\br\.(Get|Post|Put|Delete|Patch)\(\s*"([^"]+)"`)
	routeGroupOpen := regexp.MustCompile(`\br\.Route\(\s*"([^"]+)"\s*,\s*func\(`)
	// Normalize chi path params ({id}, {approvalID}, {approval_id}, ...) to a
	// single placeholder so e.g. {id} and {jobID} at the same position are
	// still recognized as the same pattern for collision purposes.
	paramName := regexp.MustCompile(`\{[a-zA-Z_][a-zA-Z0-9_]*\}`)

	for _, entry := range entries {
		name := entry.Name()
		if entry.IsDir() || !strings.HasSuffix(name, ".go") || strings.HasSuffix(name, "_test.go") {
			continue
		}
		path := filepath.Join(dir, name)
		data, err := os.ReadFile(path)
		if err != nil {
			t.Fatalf("failed to read %s: %v", path, err)
		}
		lines := strings.Split(string(data), "\n")

		// Track r.Route("/prefix", func(r chi.Router) { ... }) nesting so a
		// route registered inside one gets its real full path — otherwise
		// e.g. r.Get("/schemas", ...) under two different r.Route mounts
		// ("/api/v1/harness" and "/api/harness") looks like a collision on
		// bare "/schemas" when the actual served paths never collide.
		type frame struct {
			prefix string
			depth  int // brace depth at which this frame's body started
		}
		var stack []frame
		depth := 0

		for i, line := range lines {
			trimmed := strings.TrimSpace(line)
			// Skip comment lines — a line explaining a past collision (like
			// this file's own doc comments) can literally quote a
			// r.Get("/path", ...) call and would otherwise self-trigger.
			isComment := strings.HasPrefix(trimmed, "//")

			if !isComment {
				if m := routeGroupOpen.FindStringSubmatch(line); m != nil {
					stack = append(stack, frame{prefix: m[1], depth: depth + strings.Count(line, "{")})
				} else {
					matches := routeCall.FindAllStringSubmatch(line, -1)
					for _, m := range matches {
						method := m[1]
						full := m[2]
						for j := len(stack) - 1; j >= 0; j-- {
							full = stack[j].prefix + full
						}
						pattern := paramName.ReplaceAllString(full, "{}")
						if seen[method] == nil {
							seen[method] = make(map[string][]string)
						}
						seen[method][pattern] = append(seen[method][pattern], name+":"+strconv.Itoa(i+1))
					}
				}
			}

			depth += strings.Count(line, "{") - strings.Count(line, "}")
			for len(stack) > 0 && depth < stack[len(stack)-1].depth {
				stack = stack[:len(stack)-1]
			}
		}
	}

	var failures []string
	for method, patterns := range seen {
		for pattern, locations := range patterns {
			if len(locations) > 1 {
				sort.Strings(locations)
				failures = append(failures, method+" "+pattern+" registered "+strconv.Itoa(len(locations))+" times: "+strings.Join(locations, ", "))
			}
		}
	}
	if len(failures) > 0 {
		sort.Strings(failures)
		t.Fatalf(
			"duplicate route registration(s) found — chi silently lets the LAST one win, "+
				"shadowing every earlier handler for that (method, pattern):\n  %s",
			strings.Join(failures, "\n  "),
		)
	}
}
