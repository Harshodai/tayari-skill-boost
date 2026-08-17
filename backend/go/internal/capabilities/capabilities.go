package capabilities

import (
	"os"
	"strings"
)

// Name is a server-side product capability. Unknown names are always disabled.
type Name string

const (
	WorkspaceAuth                         Name = "workspace.auth"
	WorkspaceResume                       Name = "workspace.resume"
	WorkspacePublicImport                 Name = "workspace.public_import"
	WorkspaceATSAssistance                Name = "workspace.ats_assistance"
	WorkspaceKnowledgeHub                 Name = "workspace.knowledge_hub"
	WorkspaceInterviewPrep                Name = "workspace.interview_prep"
	WorkspaceApplicationTrack             Name = "workspace.application_tracker"
	AutonomousBrowser                     Name = "autonomous.browser"
	WorkspaceIsolatedComputer             Name = "workspace.isolated_computer"
	WorkspaceLocalBrowserBridge           Name = "workspace.local_browser_bridge"
	WorkspaceLocalBrowserSensitiveActions Name = "workspace.local_browser_sensitive_actions"
	WorkspaceComputerSubmission           Name = "workspace.computer_submission"
	AutonomousATSSubmit                   Name = "autonomous.ats_submit"
	AutonomousGmail                       Name = "autonomous.gmail"
	AutonomousMessaging                   Name = "autonomous.messaging"
	AutonomousBilling                     Name = "autonomous.billing"
	AutonomousIrreversible                Name = "autonomous.irreversible_jobs"
)

var known = map[Name]struct{}{
	WorkspaceAuth: {}, WorkspaceResume: {}, WorkspacePublicImport: {},
	WorkspaceATSAssistance: {}, WorkspaceKnowledgeHub: {}, WorkspaceInterviewPrep: {},
	WorkspaceApplicationTrack: {}, WorkspaceIsolatedComputer: {}, WorkspaceLocalBrowserBridge: {},
	WorkspaceLocalBrowserSensitiveActions: {}, WorkspaceComputerSubmission: {}, AutonomousBrowser: {}, AutonomousATSSubmit: {},
	AutonomousGmail: {}, AutonomousMessaging: {}, AutonomousBilling: {}, AutonomousIrreversible: {},
}

type Registry struct {
	enabled map[Name]bool
}

// NewFromEnv uses a conservative policy: workspace capabilities are enabled in
// development, but every capability is disabled in staging/production until an
// operator explicitly enables the workspace bundle. Autonomous capabilities are
// always disabled unless their individual flag is explicitly true.
func NewFromEnv() *Registry {
	env := strings.ToLower(strings.TrimSpace(os.Getenv("APP_ENV")))
	workspaceDefault := env != "production" && env != "prod" && env != "staging"
	registry := &Registry{enabled: make(map[Name]bool, len(known))}
	for name := range known {
		defaultValue := workspaceDefault && strings.HasPrefix(string(name), "workspace.")
		registry.enabled[name] = envBool(capabilityEnvKey(name), defaultValue)
	}
	return registry
}

func (r *Registry) Enabled(name Name) bool {
	if r == nil {
		return false
	}
	if _, ok := known[name]; !ok {
		return false
	}
	return r.enabled[name]
}

func (r *Registry) SetForTest(name Name, enabled bool) {
	if r == nil {
		return
	}
	if _, ok := known[name]; ok {
		r.enabled[name] = enabled
	}
}

func capabilityEnvKey(name Name) string {
	value := strings.ToUpper(strings.ReplaceAll(strings.ReplaceAll(string(name), ".", "_"), "-", "_"))
	return "CAPABILITY_" + value
}

func envBool(key string, fallback bool) bool {
	value, ok := os.LookupEnv(key)
	if !ok {
		return fallback
	}
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "1", "true", "yes", "on":
		return true
	default:
		return false
	}
}
