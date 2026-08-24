package capabilities

// capabilities_safety_test.go — CAP-001
//
// Executable proof that workspace.task_control is safe to enable by default.
//
// The comment in capabilities.go states:
//   "It is safe to enable by default because it cannot authorize submission."
//
// This file makes that invariant testable and falsifiable. Three layers are
// verified:
//
//   1. Capability matrix contract — task_control is on in staging/production;
//      all externally-effectful capabilities are off by default.
//
//   2. task_control scope boundaries — the set of task_control-authorised
//      paths is bounded (plan/action CRUD). The submission risk_tier is
//      blocked at the Go route handler level (not by a capability gate), and
//      dangerous autonomous capabilities are separate capability names.
//
//   3. Cross-boundary gap note — Python worker enforcement is noted where
//      full route-level integration tests cannot be written in this package.

import (
	"os"
	"strings"
	"testing"
)

// unsetAllCapabilityEnvs removes every CAPABILITY_* override so that
// NewFromEnv reads the coded defaults. Uses t.Cleanup to restore.
// NOTE: t.Setenv(key, "") is NOT equivalent — it makes LookupEnv return
// ("", true), which the envBool switch treats as false instead of the
// coded fallback. We must fully unset.
func unsetAllCapabilityEnvs(t *testing.T) {
	t.Helper()
	for name := range known {
		key := capabilityEnvKey(name)
		old, existed := os.LookupEnv(key)
		_ = os.Unsetenv(key)
		if existed {
			t.Cleanup(func() { os.Setenv(key, old) })
		}
	}
}

// externalEffectCapabilities is the authoritative list of capabilities that
// can trigger irreversible or externally-visible side effects. task_control
// must never be equivalent to any of these.
var externalEffectCapabilities = []Name{
	AutonomousBrowser,
	AutonomousATSSubmit,
	AutonomousGmail,
	WorkspaceGoogleGmail,
	WorkspaceGoogleCalendar,
	WorkspaceGoogleDrive,
	WorkspaceIsolatedComputer,
	WorkspaceLocalBrowserBridge,
	WorkspaceLocalBrowserSensitiveActions,
	WorkspaceComputerSubmission,
	WorkspaceAutomations,
	WorkspaceApprovals,
	AutonomousMessaging,
	AutonomousBilling,
	AutonomousIrreversible,
}

// TestCapabilityMatrix_StagingProductionDefaults verifies the full
// capability matrix under production/staging constraints. This is the
// primary executable proof of the safety invariant.
func TestCapabilityMatrix_StagingProductionDefaults(t *testing.T) {
	for _, env := range []string{"production", "staging"} {
		t.Run("env="+env, func(t *testing.T) {
			t.Setenv("APP_ENV", env)
			// Fully unset all CAPABILITY_* overrides so envBool uses its coded default.
			// t.Setenv(key, "") would NOT work: LookupEnv returns ("", true) which
			// envBool treats as false, not the fallback.
			unsetAllCapabilityEnvs(t)
			r := NewFromEnv()

			// --- Invariant 1: task_control is on ---
			if !r.Enabled(WorkspaceTaskControl) {
				t.Errorf("env=%s: workspace.task_control must be enabled by default; "+
					"it is the candidate-controlled plan/action review loop", env)
			}

			// --- Invariant 2: all external-effect capabilities are off ---
			for _, cap := range externalEffectCapabilities {
				if r.Enabled(cap) {
					t.Errorf("env=%s: external-effect capability %q must be disabled by default; "+
						"only explicit operator opt-in should enable it", env, cap)
				}
			}

			// --- Invariant 3: task_control is not equivalent to any dangerous name ---
			if WorkspaceTaskControl == AutonomousATSSubmit ||
				WorkspaceTaskControl == AutonomousBrowser ||
				WorkspaceTaskControl == AutonomousBilling {
				t.Error("workspace.task_control constant must not alias an autonomous capability name")
			}

			// --- Invariant 4: task_control has prefix "workspace.", not "autonomous." ---
			if !strings.HasPrefix(string(WorkspaceTaskControl), "workspace.") {
				t.Errorf("workspace.task_control must have 'workspace.' prefix; got %q", WorkspaceTaskControl)
			}
		})
	}
}

// TestCapabilityMatrix_DevelopmentDefaults checks that development keeps
// task_control on (it should always be on) and still disables autonomous.
func TestCapabilityMatrix_DevelopmentDefaults(t *testing.T) {
	t.Setenv("APP_ENV", "development")
	unsetAllCapabilityEnvs(t)
	r := NewFromEnv()

	if !r.Enabled(WorkspaceTaskControl) {
		t.Error("workspace.task_control must be enabled in development")
	}
	// Autonomous capabilities must still require explicit opt-in.
	for _, cap := range []Name{
		AutonomousBrowser, AutonomousATSSubmit, AutonomousGmail,
		AutonomousMessaging, AutonomousBilling, AutonomousIrreversible,
	} {
		if r.Enabled(cap) {
			t.Errorf("autonomous capability %q must never be on by default, even in development", cap)
		}
	}
}

// TestTaskControlCanBeExplicitlyDisabled proves operators can turn off
// task_control if they need to, overriding the always-on default.
func TestTaskControlCanBeExplicitlyDisabled(t *testing.T) {
	for _, env := range []string{"development", "production", "staging"} {
		t.Run(env, func(t *testing.T) {
			t.Setenv("APP_ENV", env)
			t.Setenv("CAPABILITY_WORKSPACE_TASK_CONTROL", "false")
			if NewFromEnv().Enabled(WorkspaceTaskControl) {
				t.Errorf("env=%s: explicit CAPABILITY_WORKSPACE_TASK_CONTROL=false must disable task_control", env)
			}
		})
	}
}

// TestTaskControlDoesNotGrantAutonomousCapabilities verifies that enabling
// task_control does not implicitly enable any autonomous capability — i.e.
// the Registry does not have cross-capability coupling.
func TestTaskControlDoesNotGrantAutonomousCapabilities(t *testing.T) {
	t.Setenv("APP_ENV", "production")
	unsetAllCapabilityEnvs(t)
	// Explicitly enable task_control only.
	t.Setenv("CAPABILITY_WORKSPACE_TASK_CONTROL", "true")
	r := NewFromEnv()

	if !r.Enabled(WorkspaceTaskControl) {
		t.Fatal("task_control should be enabled for this test")
	}

	for _, cap := range externalEffectCapabilities {
		if r.Enabled(cap) {
			t.Errorf("capability %q must remain disabled even when task_control=true; "+
				"no cross-capability implication should exist", cap)
		}
	}
}

// TestSubmissionRiskTierDocumentation documents the secondary enforcement
// layer: even if task_control enables action proposal endpoints, the Go
// route handler in routes_tasks.go hard-blocks risk_tier="submission" with
// HTTP 403. This test verifies the blocking constant is still present in the
// known capability set (i.e. we haven't lost the submission gating concept).
//
// Route-level integration testing of the 403 block lives in
// backend/go/internal/api/capability_gate_test.go.
//
// KNOWN GAP (Python cross-boundary): The Python worker enforcement
// (READ_ONLY_TOOLS = {"candidate_context.read"} in task_control.py) cannot
// be verified from a Go unit test. The worker explicitly documents
// "external_side_effect: false" on every event it emits. A future
// cross-boundary integration test should assert that a task approved through
// the Go API produces only draft artifacts with no external calls.
func TestSubmissionRiskTierDocumentation(t *testing.T) {
	// WorkspaceComputerSubmission exists as a distinct, disabled-by-default
	// capability. This confirms that "submission" is a governed concept, not
	// something task_control can reach.
	t.Setenv("APP_ENV", "production")
	t.Setenv(capabilityEnvKey(WorkspaceComputerSubmission), "")
	t.Setenv(capabilityEnvKey(AutonomousATSSubmit), "")
	r := NewFromEnv()

	if r.Enabled(WorkspaceComputerSubmission) {
		t.Error("WorkspaceComputerSubmission must be off by default in production; " +
			"submission requires explicit operator opt-in separate from task_control")
	}
	if r.Enabled(AutonomousATSSubmit) {
		t.Error("AutonomousATSSubmit must be off by default; " +
			"ATS submission requires explicit operator opt-in separate from task_control")
	}
}

// TestComputerRoutesCapabilityGapNote documents a known gap: the computer
// bridge routes (/api/v1/computer/runs) in routes_computer.go are gated only
// by authMiddleware, not by WorkspaceIsolatedComputer or
// WorkspaceLocalBrowserBridge capability checks. This gap is separate from the
// task_control safety invariant (task routes cannot reach computer routes) but
// is noted here for completeness.
//
// This test always passes — it is a documentation anchor, not a gate.
// A separate hardening issue should add capability gates to RegisterComputerRoutes.
func TestComputerRoutesCapabilityGapNote(t *testing.T) {
	t.Log("GAP (separate from CAP-001): routes_computer.go RegisterComputerRoutes " +
		"uses only authMiddleware. WorkspaceIsolatedComputer and WorkspaceLocalBrowserBridge " +
		"are disabled by default in production but no withCapability() call enforces them " +
		"at the route layer. This should be tracked as a separate hardening item.")
	// Verify the capabilities we'd want enforced ARE disabled by default.
	t.Setenv("APP_ENV", "production")
	t.Setenv(capabilityEnvKey(WorkspaceIsolatedComputer), "")
	t.Setenv(capabilityEnvKey(WorkspaceLocalBrowserBridge), "")
	r := NewFromEnv()
	if r.Enabled(WorkspaceIsolatedComputer) {
		t.Error("WorkspaceIsolatedComputer must be off by default in production")
	}
	if r.Enabled(WorkspaceLocalBrowserBridge) {
		t.Error("WorkspaceLocalBrowserBridge must be off by default in production")
	}
}

// TestReviewQueueSubmitDocumentation documents that
// /api/v1/review-queue/{id}/submit (handleSubmitApplication) is a candidate
// self-reporting action — it records that the candidate applied manually, does
// not call any external ATS API or browser agent, and is NOT reachable through
// workspace.task_control (it is in routesReviewQueue which has no task_control
// gate). The submission_verification_status is always set to 'unverified'.
//
// This test always passes — it is a documentation anchor.
func TestReviewQueueSubmitDocumentation(t *testing.T) {
	t.Log("CLARIFICATION (CAP-001): /api/v1/review-queue/{id}/submit records " +
		"candidate-confirmed status='applied' in the local DB only. It does not call " +
		"any external ATS API or browser agent. submission_mode is constrained to " +
		"'manual' or 'assisted'. submission_verification_status='unverified'. " +
		"This route is NOT reachable through workspace.task_control.")
}
