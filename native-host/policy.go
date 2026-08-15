package main

var methodRisk = map[string]string{
	"get_status":             "read",
	"open_desktop_task":      "navigation",
	"subscribe_task_events":  "read",
	"request_takeover":       "control",
	"stop_task":              "control",
	"capture_local_evidence": "sensitive",
	"request_user_file":      "sensitive",
}

func AllowedMethod(method string) bool { _, ok := methodRisk[method]; return ok }
func AllowedMethods() []string {
	return []string{"get_status", "open_desktop_task", "subscribe_task_events", "request_takeover", "stop_task", "capture_local_evidence", "request_user_file"}
}
func validTaskID(value string) bool {
	if len(value) < 8 || len(value) > 128 {
		return false
	}
	for _, r := range value {
		if !(r == '-' || r == '_' || r == '.' || r >= 'a' && r <= 'z' || r >= 'A' && r <= 'Z' || r >= '0' && r <= '9') {
			return false
		}
	}
	return true
}
