package clientip

import (
	"fmt"
	"net"
	"net/http"
	"strings"
)

// Resolver extracts the original client IP only when the immediate peer is a
// configured trusted proxy. An untrusted caller cannot spoof X-Forwarded-For
// or X-Real-IP to evade abuse controls or alter audit attribution.
type Resolver struct {
	networks []*net.IPNet
}

// NewResolver parses a comma-separated list of IPs or CIDRs. An empty value is
// intentionally fail-closed: forwarded headers are ignored until an operator
// explicitly declares the proxy network.
func NewResolver(raw string) (*Resolver, error) {
	resolver := &Resolver{}
	for _, item := range strings.Split(raw, ",") {
		item = strings.TrimSpace(item)
		if item == "" {
			continue
		}
		if ip := net.ParseIP(item); ip != nil {
			bits := 128
			if ip.To4() != nil {
				ip = ip.To4()
				bits = 32
			}
			resolver.networks = append(resolver.networks, &net.IPNet{IP: ip, Mask: net.CIDRMask(bits, bits)})
			continue
		}
		_, network, err := net.ParseCIDR(item)
		if err != nil {
			return nil, fmt.Errorf("invalid trusted proxy CIDR %q: %w", item, err)
		}
		resolver.networks = append(resolver.networks, network)
	}
	return resolver, nil
}

func (r *Resolver) trusted(peer net.IP) bool {
	if r == nil || peer == nil {
		return false
	}
	for _, network := range r.networks {
		if network.Contains(peer) {
			return true
		}
	}
	return false
}

func remoteIP(remoteAddr string) net.IP {
	host, _, err := net.SplitHostPort(strings.TrimSpace(remoteAddr))
	if err != nil {
		host = strings.TrimSpace(remoteAddr)
	}
	return net.ParseIP(host)
}

func normalizeIP(value string) string {
	value = strings.TrimSpace(value)
	if value == "" {
		return ""
	}
	if ip := net.ParseIP(value); ip != nil {
		return ip.String()
	}
	return ""
}

// Resolve returns the original client IP when the request peer is trusted,
// otherwise it returns the immediate peer IP or a stable remote-address value.
func (r *Resolver) Resolve(req *http.Request) string {
	peer := remoteIP(req.RemoteAddr)
	if r.trusted(peer) {
		if forwarded := req.Header.Get("X-Forwarded-For"); forwarded != "" {
			parts := strings.Split(forwarded, ",")
			// The left-most address is the original client when the trusted
			// proxy has sanitized and appended the chain.
			if ip := normalizeIP(parts[0]); ip != "" {
				return ip
			}
		}
		if ip := normalizeIP(req.Header.Get("X-Real-IP")); ip != "" {
			return ip
		}
	}
	if peer != nil {
		return peer.String()
	}
	if remote := strings.TrimSpace(req.RemoteAddr); remote != "" {
		return remote
	}
	return "unknown"
}
