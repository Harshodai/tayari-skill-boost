package main

import "testing"

func TestCapabilityVerifierFailClosed(t *testing.T) {
  verifier := &CapabilityVerifier{expected: []byte("secret")}
  if !verifier.Verify("secret") || verifier.Verify("wrong") || (&CapabilityVerifier{}).Verify("secret") { t.Fatal("capability verifier did not fail closed") }
}
