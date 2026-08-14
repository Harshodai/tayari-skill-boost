#!/usr/bin/env bash
set -euo pipefail
CI_JWT_SECRET='test-jwt-secret-for-ci-only-change-me-32ch'
b64url() {
  printf '%s' "$1" | openssl base64 -A | tr '+/' '-_' | tr -d '='
}
JWT_HEADER=$(b64url '{"alg":"HS256","typ":"JWT"}')
JWT_IAT=$(date +%s)
JWT_EXP=$((JWT_IAT + 31536000))
jwt_for_role() {
  role="$1"
  payload=$(b64url "{\"role\":\"${role}\",\"iss\":\"supabase-demo\",\"iat\":${JWT_IAT},\"exp\":${JWT_EXP}}")
  signing_input="${JWT_HEADER}.${payload}"
  signature=$(printf '%s' "$signing_input" | openssl dgst -sha256 -hmac "$CI_JWT_SECRET" -binary | openssl base64 -A | tr '+/' '-_' | tr -d '=')
  printf '%s.%s' "$signing_input" "$signature"
}
for role in anon service_role; do
  token=$(jwt_for_role "$role")
  test "$(printf '%s' "$token" | awk -F. '{print NF}')" -eq 3
  test "${token#*.}" != "$token"
  printf '%s token generated with three JWT segments\n' "$role"
done
