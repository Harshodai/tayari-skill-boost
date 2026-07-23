package api

import (
	"encoding/json"
	"net/http"
	"reflect"

	"github.com/go-playground/validator/v10"
)

var validate = validator.New()

// DecodeAndValidate reads JSON from r and validates the struct.
// If v is not a struct (or pointer-to-struct) — e.g. a map payload —
// it decodes without struct validation, since validator.Struct would
// return InvalidValidationError for such types.
func DecodeAndValidate(r *http.Request, v interface{}) error {
	if err := json.NewDecoder(r.Body).Decode(v); err != nil {
		return err
	}
	t := reflect.TypeOf(v)
	for t != nil && t.Kind() == reflect.Ptr {
		t = t.Elem()
	}
	if t == nil || t.Kind() != reflect.Struct {
		return nil
	}
	return validate.Struct(v)
}


func ValidateFileSignature(data []byte, allowedExts ...string) bool {
	if len(data) < 4 {
		return false
	}
	// Very simple magic byte check
	isPDF := data[0] == '%' && data[1] == 'P' && data[2] == 'D' && data[3] == 'F'
	// docx is a zip file starting with PK
	isZIP := data[0] == 'P' && data[1] == 'K' && data[2] == 0x03 && data[3] == 0x04

	for _, ext := range allowedExts {
		if ext == "pdf" && isPDF {
			return true
		}
		if ext == "docx" && isZIP {
			return true
		}
	}
	return false
}
