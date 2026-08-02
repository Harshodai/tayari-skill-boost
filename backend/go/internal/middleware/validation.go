package middleware

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"reflect"
	"strings"

	"github.com/go-playground/validator/v10"
)

const maxRequestBodySize = 1 << 20 // 1 MB

var validate = validator.New()

func init() {
	// Register tag-name function to use JSON field names (without omitempty)
	validate.RegisterTagNameFunc(func(fld reflect.StructField) string {
		jsonTag := fld.Tag.Get("json")
		if jsonTag == "" || jsonTag == "-" {
			return fld.Name
		}
		// Split by comma and take the first part (the field name), ignore omitempty
		parts := strings.Split(jsonTag, ",")
		if parts[0] == "" {
			return fld.Name
		}
		return parts[0]
	})
}

type ValidationErrorResponse struct {
	Error   string            `json:"error"`
	Details map[string]string `json:"details"`
}

func ValidateBody[T any]() func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			var body T
			// Limit request body size to prevent unbounded memory allocation
			limitedReader := io.LimitReader(r.Body, maxRequestBodySize+1)
			bodyBytes, err := io.ReadAll(limitedReader)
			if err != nil {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusBadRequest)
				json.NewEncoder(w).Encode(ValidationErrorResponse{
					Error:   "Invalid request body",
					Details: map[string]string{"body": "Unable to read body"},
				})
				return
			}
			// Check if body was truncated (exceeded max size)
			if len(bodyBytes) > maxRequestBodySize {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusBadRequest)
				json.NewEncoder(w).Encode(ValidationErrorResponse{
					Error:   "Request body too large",
					Details: map[string]string{"body": fmt.Sprintf("Maximum size is %d bytes", maxRequestBodySize)},
				})
				return
			}
			r.Body = io.NopCloser(bytes.NewBuffer(bodyBytes))

			if err := json.Unmarshal(bodyBytes, &body); err != nil {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusBadRequest)
				json.NewEncoder(w).Encode(ValidationErrorResponse{
					Error:   "Invalid JSON payload format",
					Details: map[string]string{"json": err.Error()},
				})
				return
			}

			if err := validate.Struct(body); err != nil {
				details := make(map[string]string)
				if validationErrors, ok := err.(validator.ValidationErrors); ok {
					for _, fieldErr := range validationErrors {
						// Use the JSON field name (registered via tag-name function)
						details[fieldErr.Field()] = fmt.Sprintf("failed check '%s'", fieldErr.Tag())
					}
				} else {
					details["validation"] = err.Error()
				}

				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusBadRequest)
				json.NewEncoder(w).Encode(ValidationErrorResponse{
					Error:   "Validation failed",
					Details: details,
				})
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}
