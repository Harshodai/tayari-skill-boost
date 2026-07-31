-- Migration: add resume_graphs table
-- Added 2026-07-01

CREATE TABLE IF NOT EXISTS resume_graphs (
    run_id UUID PRIMARY KEY,
    graph JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Trigger to update updated_at on row modification
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_updated_at ON resume_graphs;
CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON resume_graphs
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
