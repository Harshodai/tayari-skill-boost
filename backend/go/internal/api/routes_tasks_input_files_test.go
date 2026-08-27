package api

import "testing"

func TestValidateTaskInputFiles(t *testing.T) {
	if err := validateTaskInputFiles([]taskInputFile{{Name: "resume.txt", MimeType: "text/plain", SizeBytes: 12, ContentBase64: "YWJj"}}); err != nil {
		t.Fatalf("valid input file rejected: %v", err)
	}
	if err := validateTaskInputFiles([]taskInputFile{{Name: "resume.txt", SizeBytes: 2*1024*1024 + 1}}); err == nil {
		t.Fatal("oversized input file was accepted")
	}
	if err := validateTaskInputFiles([]taskInputFile{{Name: "resume.txt", ReadError: "could not read", ContentBase64: "YWJj"}}); err == nil {
		t.Fatal("file with read error and content was accepted")
	}
}
