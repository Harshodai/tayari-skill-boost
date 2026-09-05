package main

import (
	"crypto/sha256"
	"crypto/subtle"
	"os"
	"path/filepath"
	"strings"
)

type CapabilityVerifier struct{ expected []byte }

func NewCapabilityVerifier() *CapabilityVerifier {
	token := strings.TrimSpace(os.Getenv("TAYARI_NATIVE_CAPABILITY_TOKEN"))
	if token == "" {
		file := os.Getenv("TAYARI_NATIVE_CAPABILITY_FILE")
		if file == "" {
			if home, err := os.UserHomeDir(); err == nil {
				file = filepath.Join(home, ".config", "job-tayari", "native-capability")
			}
		}
		if data, err := os.ReadFile(file); err == nil {
			token = strings.TrimSpace(string(data))
		}
	}
	return &CapabilityVerifier{expected: []byte(token)}
}
func (v *CapabilityVerifier) Verify(candidate string) bool {
	if len(v.expected) == 0 || candidate == "" {
		return false
	}
	actual := sha256.Sum256([]byte(candidate))
	expected := sha256.Sum256(v.expected)
	return subtle.ConstantTimeCompare(actual[:], expected[:]) == 1
}
