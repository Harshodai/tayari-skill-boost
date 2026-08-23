package api

import (
	"fmt"
	"net/http"
	"testing"
	
	"github.com/go-chi/chi/v5"
	"tayari-backend/internal/config"
	"tayari-backend/internal/database"
)

func TestCheckRoutes(t *testing.T) {
	srv := NewServer(&hermesMockAuth{}, &config.Config{}, &database.DB{Conn: nil})
	
	chi.Walk(srv.Router, func(method, route string, _ http.Handler, _ ...func(http.Handler) http.Handler) error {
		fmt.Printf("%s %s\n", method, route)
		return nil
	})
}
