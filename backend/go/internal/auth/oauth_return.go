package auth

import (
	"net/http"
	"strings"
)

const returnToCookieName = "oauth_return_to"

func allowedOAuthReturnTo(value, frontendURL string) string {
	fallback := strings.TrimRight(frontendURL, "/") + "/auth/callback"
	if value == "tayari://auth/callback" || value == fallback {
		return value
	}
	return fallback
}

func setOAuthReturnToCookie(w http.ResponseWriter, value, frontendURL string) {
	http.SetCookie(w, &http.Cookie{
		Name: returnToCookieName, Value: allowedOAuthReturnTo(value, frontendURL), Path: "/",
		MaxAge: stateCookieAge, HttpOnly: true, Secure: isSecureEnv(), SameSite: http.SameSiteLaxMode,
	})
}

func consumeOAuthReturnTo(w http.ResponseWriter, r *http.Request, frontendURL string) string {
	value := ""
	if cookie, err := r.Cookie(returnToCookieName); err == nil {
		value = cookie.Value
	}
	http.SetCookie(w, &http.Cookie{
		Name: returnToCookieName, Value: "", Path: "/", MaxAge: -1,
		HttpOnly: true, Secure: isSecureEnv(), SameSite: http.SameSiteLaxMode,
	})
	return allowedOAuthReturnTo(value, frontendURL)
}
