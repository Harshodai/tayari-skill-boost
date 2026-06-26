CREATE TABLE IF NOT EXISTS api_keys (
    id          BIGSERIAL PRIMARY KEY,
    user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    key_prefix  TEXT NOT NULL,
    key_hash    TEXT NOT NULL UNIQUE,
    is_active   BOOLEAN NOT NULL DEFAULT true,
    rate_limit  INTEGER NOT NULL DEFAULT 60,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_used_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS api_usage (
    id          BIGSERIAL PRIMARY KEY,
    api_key_id  BIGINT NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
    endpoint    TEXT NOT NULL,
    status_code INTEGER NOT NULL DEFAULT 200,
    ip_address  TEXT,
    response_ms INTEGER,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash ON api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_api_usage_api_key_id ON api_usage(api_key_id);
CREATE INDEX IF NOT EXISTS idx_api_usage_created_at ON api_usage(created_at);
