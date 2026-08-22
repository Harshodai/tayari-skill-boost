package clientip

import (
	"net/http/httptest"
	"testing"
)

func TestResolveIgnoresForwardedHeadersFromUntrustedPeer(t *testing.T) {
	resolver, err := NewResolver("10.0.0.0/8")
	if err != nil {
		t.Fatal(err)
	}
	req := httptest.NewRequest("GET", "http://example.test", nil)
	req.RemoteAddr = "192.0.2.10:1234"
	req.Header.Set("X-Forwarded-For", "203.0.113.50")
	req.Header.Set("X-Real-IP", "203.0.113.51")
	if got := resolver.Resolve(req); got != "192.0.2.10" {
		t.Fatalf("untrusted forwarded header changed client identity: got %q", got)
	}
}

func TestResolveUsesOriginalAddressFromTrustedProxy(t *testing.T) {
	resolver, err := NewResolver("10.0.0.0/8")
	if err != nil {
		t.Fatal(err)
	}
	req := httptest.NewRequest("GET", "http://example.test", nil)
	req.RemoteAddr = "10.10.10.10:1234"
	req.Header.Set("X-Forwarded-For", "203.0.113.50, 10.10.10.10")
	if got := resolver.Resolve(req); got != "203.0.113.50" {
		t.Fatalf("trusted proxy chain was not resolved: got %q", got)
	}
}

func TestNewResolverRejectsMalformedCIDR(t *testing.T) {
	if _, err := NewResolver("not-a-network"); err == nil {
		t.Fatal("expected malformed trusted proxy CIDR to be rejected")
	}
}
