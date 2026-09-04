package models

import (
	"reflect"
	"testing"
)

func TestJSONMap_Value(t *testing.T) {
	tests := []struct {
		name  string
		input JSONMap
		wantNil bool
	}{
		{"nil returns nil", nil, true},
		{"empty map marshals", JSONMap{}, false},
		{"simple map marshals", JSONMap{"a": "b"}, false},
		{"nested map marshals", JSONMap{"x": map[string]any{"y": 1}}, false},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			v, err := tc.input.Value()
			if err != nil {
				t.Fatalf("Value() err = %v", err)
			}
			if tc.wantNil && v != nil {
				t.Fatalf("want nil, got %v", v)
			}
			if !tc.wantNil && v == nil {
				t.Fatal("want non-nil, got nil")
			}
		})
	}
}

func TestJSONMap_Scan(t *testing.T) {
	tests := []struct {
		name    string
		input   any
		want    JSONMap
		wantErr bool
	}{
		{"nil clears", nil, nil, false},
		{"bytes object", []byte(`{"a":"b"}`), JSONMap{"a": "b"}, false},
		{"string object", `{"a":"b"}`, JSONMap{"a": "b"}, false},
		{"invalid bytes error", []byte(`{bad`), nil, true},
		{"unsupported type ignored", 42, nil, false},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			var m JSONMap
			err := m.Scan(tc.input)
			if tc.wantErr && err == nil {
				t.Fatal("want err, got nil")
			}
			if !tc.wantErr && err != nil {
				t.Fatalf("Scan() err = %v", err)
			}
			if !tc.wantErr && tc.input != nil {
				if _, ok := tc.input.(int); !ok && !reflect.DeepEqual(m, tc.want) && tc.want != nil {
					t.Fatalf("want %v, got %v", tc.want, m)
				}
			}
		})
	}
}

func TestStringSlice_Value(t *testing.T) {
	tests := []struct {
		name  string
		input StringSlice
		want  any
	}{
		{"nil returns nil", nil, nil},
		{"simple joins", StringSlice{"a", "b"}, "{a,b}"},
		{"spaces quoted", StringSlice{"b c", "d"}, `{"b c",d}`},
		{"empty string quoted", StringSlice{""}, `{""}`},
		{"comma quoted", StringSlice{"a,b"}, `{"a,b"}`},
		{"backslash escaped", StringSlice{`a\b`}, `{"a\\b"}`},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			v, err := tc.input.Value()
			if err != nil {
				t.Fatalf("Value() err = %v", err)
			}
			if tc.want == nil && v != nil {
				t.Fatalf("want nil, got %v", v)
			}
			if tc.want != nil && v != tc.want {
				t.Fatalf("want %v, got %v", tc.want, v)
			}
		})
	}
}

func TestStringSlice_Scan(t *testing.T) {
	tests := []struct {
		name  string
		input any
		want  StringSlice
	}{
		{"nil clears", nil, nil},
		{"empty bytes nil", []byte{}, nil},
		{"json array bytes", []byte(`["a","b"]`), StringSlice{"a", "b"}},
		{"postgres bytes", []byte(`{a,"b c",d}`), StringSlice{"a", "b c", "d"}},
		{"empty string nil", "", nil},
		{"json array string", `["x"]`, StringSlice{"x"}},
		{"postgres string", `{a,b}`, StringSlice{"a", "b"}},
		{"empty pg array", `{}`, nil},
		{"malformed returns nil", `nope`, nil},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			var s StringSlice = StringSlice{"stale"}
			if err := s.Scan(tc.input); err != nil {
				t.Fatalf("Scan() err = %v", err)
			}
			if !reflect.DeepEqual(s, tc.want) {
				t.Fatalf("want %v, got %v", tc.want, s)
			}
		})
	}
}

func TestLogEntrySlice_ValueScan(t *testing.T) {
	var nilSlice LogEntrySlice
	v, err := nilSlice.Value()
	if err != nil || v != nil {
		t.Fatalf("nil Value() = %v,%v want nil,nil", v, err)
	}
	src := LogEntrySlice{{"step": "a"}}
	v, err = src.Value()
	if err != nil || v == nil {
		t.Fatalf("Value() = %v,%v", v, err)
	}
	var out LogEntrySlice
	raw, _ := src.Value()
	b, _ := raw.([]byte)
	if err := out.Scan(b); err != nil {
		t.Fatalf("Scan(bytes) err = %v", err)
	}
	if len(out) != 1 || out[0]["step"] != "a" {
		t.Fatalf("roundtrip got %v", out)
	}
	var s2 LogEntrySlice
	if err := s2.Scan(nil); err != nil || s2 != nil {
		t.Fatalf("Scan(nil) = %v,%v", s2, err)
	}
	var s3 LogEntrySlice
	if err := s3.Scan(`[{"step":"b"}]`); err != nil || len(s3) != 1 {
		t.Fatalf("Scan(string) = %v,%v", s3, err)
	}
	var s4 LogEntrySlice
	if err := s4.Scan(42); err == nil {
		t.Fatal("want err for int input")
	}
}
