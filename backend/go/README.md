# Go API Gateway

The core backend service handling authentication, authorization, and API routing.

## Structure

```
go/
├── cmd/server/       # Application entry point
│   └── main.go
└── internal/         # Private packages
    ├── api/          # HTTP handlers & routes
    ├── auth/         # Authentication (local + social)
    ├── config/       # Environment configuration
    ├── concurrency/  # Worker pools for async tasks
    ├── database/     # PostgreSQL connection
    └── models/       # Data structures
```

## Key Features

- **Dual-Mode Auth**: Switch between Supabase and local JWT
- **Social Login**: Google, GitHub, LinkedIn via Goth
- **CSRF Protection**: State tokens for OAuth flows
- **Async Logging**: Worker pool for audit logs

## Development

```bash
# Run locally (requires DB — start supabase-local/'s db service, or run
# the full stack and point DATABASE_URL at it, see root CLAUDE.md)
cd backend/go
go run cmd/server/main.go

# Or via Docker
docker compose --profile dev up -d go-backend
```

## Dependencies

- `chi` - HTTP router
- `pgx` - PostgreSQL driver
- `goth` - OAuth library
- `jwt` - Token generation
