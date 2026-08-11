package api

import "testing"

func TestNormalizeApplicationStatus(t *testing.T) {
	tests := []struct {
		name    string
		input   string
		want    string
		allowed bool
	}{
		{name: "normalizes surrounding whitespace and case", input: "  APPLIED  ", want: "applied", allowed: true},
		{name: "allows candidate review state", input: "review", want: "review", allowed: true},
		{name: "allows existing interview state", input: "technical_interview", want: "technical_interview", allowed: true},
		{name: "rejects arbitrary label", input: "definitely_submitted", want: "definitely_submitted", allowed: false},
		{name: "rejects empty value", input: "", want: "", allowed: false},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			got, allowed := normalizeApplicationStatus(test.input)
			if got != test.want || allowed != test.allowed {
				t.Fatalf("normalizeApplicationStatus(%q) = (%q, %t), want (%q, %t)", test.input, got, allowed, test.want, test.allowed)
			}
		})
	}
}
