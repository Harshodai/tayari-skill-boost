#!/bin/bash
set -e

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -f /docker-entrypoint-initdb.d/init.sql
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -f /docker-entrypoint-initdb.d/mvp_additions.sql

for f in /docker-entrypoint-initdb.d/migrations/*.sql; do
    psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -f "$f"
done

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -c "
INSERT INTO tenants (id, name, domain, created_at)
SELECT gen_random_uuid(), 'Default', 'localhost', NOW()
WHERE NOT EXISTS (SELECT 1 FROM tenants WHERE domain = 'localhost');
INSERT INTO tenants (id, name, domain, created_at)
SELECT gen_random_uuid(), 'Localhost-IP', '127.0.0.1', NOW()
WHERE NOT EXISTS (SELECT 1 FROM tenants WHERE domain = '127.0.0.1');
"
