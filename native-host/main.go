package main

import (
	"fmt"
	"os/exec"
	"runtime"
	"strings"
)

type Request struct {
	ID         string         `json:"id"`
	Method     string         `json:"method"`
	Params     map[string]any `json:"params"`
	Capability string         `json:"capability"`
}
type Response struct {
	ID     string `json:"id"`
	Result any    `json:"result,omitempty"`
	Error  string `json:"error,omitempty"`
}

func main() {
	verifier := NewCapabilityVerifier()
	for {
		var request Request
		if err := ReadMessage(&request); err != nil {
			return
		}
		response := dispatch(request, verifier)
		if err := WriteMessage(response); err != nil {
			return
		}
	}
}

func dispatch(request Request, verifier *CapabilityVerifier) Response {
	if request.ID == "" {
		return Response{Error: "request id is required"}
	}
	if !AllowedMethod(request.Method) {
		return Response{ID: request.ID, Error: "method is not allowed"}
	}
	if request.Method != "get_status" && !verifier.Verify(request.Capability) {
		return Response{ID: request.ID, Error: "native capability is required"}
	}
	switch request.Method {
	case "get_status":
		return Response{ID: request.ID, Result: map[string]any{"connected": true, "host_version": "0.1.0", "platform": runtime.GOOS, "capability_required": true, "methods": AllowedMethods()}}
	case "open_desktop_task":
		taskID, _ := request.Params["task_id"].(string)
		if !validTaskID(taskID) {
			return Response{ID: request.ID, Error: "valid task_id is required"}
		}
		if err := openDesktopTask(taskID); err != nil {
			return Response{ID: request.ID, Error: err.Error()}
		}
		return Response{ID: request.ID, Result: map[string]any{"opened": true, "task_id": taskID}}
	case "subscribe_task_events":
		return Response{ID: request.ID, Result: map[string]any{"status": "accepted", "transport": "shared-api"}}
	case "request_takeover", "stop_task":
		taskID, _ := request.Params["task_id"].(string)
		if !validTaskID(taskID) {
			return Response{ID: request.ID, Error: "valid task_id is required"}
		}
		return Response{ID: request.ID, Result: map[string]any{"status": "accepted", "task_id": taskID, "method": request.Method}}
	case "capture_local_evidence":
		return Response{ID: request.ID, Result: map[string]any{"status": "user_action_required", "reason": "local evidence capture must be approved by the desktop user"}}
	case "request_user_file":
		return Response{ID: request.ID, Result: map[string]any{"status": "user_action_required", "reason": "file access must be approved in the desktop app"}}
	default:
		return Response{ID: request.ID, Error: fmt.Sprintf("unsupported method %q", strings.TrimSpace(request.Method))}
	}
}

func openDesktopTask(taskID string) error {
	target := "tayari://desktop/tasks/" + taskID
	var command *exec.Cmd
	switch runtime.GOOS {
	case "darwin":
		command = exec.Command("open", target)
	case "windows":
		command = exec.Command("cmd", "/c", "start", "", target)
	default:
		command = exec.Command("xdg-open", target)
	}
	if err := command.Run(); err != nil {
		return fmt.Errorf("could not open desktop task: %w", err)
	}
	return nil
}
