package capabilities

import "testing"

func TestUnknownCapabilityIsDisabled(t *testing.T) {
	registry := &Registry{enabled: map[Name]bool{}}
	if registry.Enabled(Name("autonomous.unknown")) {
		t.Fatal("unknown capability must be disabled")
	}
}

func TestHighRiskCapabilityIsDisabledByDefault(t *testing.T) {
	t.Setenv("APP_ENV", "production")
	t.Setenv("CAPABILITY_AUTONOMOUS_BROWSER", "")
	registry := NewFromEnv()
	if registry.Enabled(AutonomousBrowser) {
		t.Fatal("autonomous browser must be disabled by default")
	}
}

func TestComputerCapabilitiesRequireExplicitFlagsInProduction(t *testing.T) {
	t.Setenv("APP_ENV", "production")
	for _, env := range []string{
		"CAPABILITY_WORKSPACE_ISOLATED_COMPUTER",
		"CAPABILITY_WORKSPACE_LOCAL_BROWSER_BRIDGE",
		"CAPABILITY_WORKSPACE_LOCAL_BROWSER_SENSITIVE_ACTIONS",
		"CAPABILITY_WORKSPACE_COMPUTER_SUBMISSION",
	} {
		t.Setenv(env, "")
	}
	registry := NewFromEnv()
	for _, capability := range []Name{
		WorkspaceIsolatedComputer,
		WorkspaceLocalBrowserBridge,
		WorkspaceLocalBrowserSensitiveActions,
		WorkspaceComputerSubmission,
	} {
		if registry.Enabled(capability) {
			t.Fatalf("%s must be disabled until explicitly promoted", capability)
		}
	}
}

func TestWorkspaceCapabilityRequiresExplicitFlagInProduction(t *testing.T) {
	t.Setenv("APP_ENV", "production")
	t.Setenv("CAPABILITY_WORKSPACE_RESUME", "")
	registry := NewFromEnv()
	if registry.Enabled(WorkspaceResume) {
		t.Fatal("workspace capability must be disabled until explicitly promoted")
	}
	t.Setenv("CAPABILITY_WORKSPACE_RESUME", "true")
	registry = NewFromEnv()
	if !registry.Enabled(WorkspaceResume) {
		t.Fatal("explicit workspace promotion should enable the capability")
	}
}
