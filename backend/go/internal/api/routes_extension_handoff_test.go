package api

import (
	"encoding/hex"
	"strings"
	"testing"
)

func TestRandomExtensionHandoffCodeIsBoundedHex(t *testing.T) {
	code, err := randomExtensionHandoffCode()
	if err != nil {
		t.Fatalf("generate handoff code: %v", err)
	}
	if len(code) != 64 {
		t.Fatalf("expected 64 hex characters, got %d", len(code))
	}
	if _, err := hex.DecodeString(code); err != nil {
		t.Fatalf("handoff code is not hex: %v", err)
	}
}

func TestExtensionHandoffHashIsStableAndNonReversibleByShape(t *testing.T) {
	const code = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
	first := extensionHandoffHash(code)
	second := extensionHandoffHash(code)
	if first != second {
		t.Fatal("same handoff code must produce a stable hash")
	}
	if first == code || strings.Contains(first, code) {
		t.Fatal("handoff hash must not contain the plaintext code")
	}
	if len(first) != 64 {
		t.Fatalf("expected SHA-256 hex hash, got %d characters", len(first))
	}
}
