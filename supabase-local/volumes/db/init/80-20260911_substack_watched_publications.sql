-- Lets a candidate register a Substack publication (one they're subscribed
-- to) for background RSS polling, so new posts land in OmniSave without the
-- candidate ever opening a browser tab on substack.com. This is the one
-- OmniSave platform where a true API-based background sync is possible —
-- LinkedIn and Medium expose no public feed for a user's saved/reading
-- content and stay dependent on the browser-companion extension.
CREATE TABLE IF NOT EXISTS substack_watched_publications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    publication_url TEXT NOT NULL,
    last_polled_at TIMESTAMPTZ,
    last_poll_status TEXT,
    last_poll_error TEXT,
    last_ingested_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, publication_url)
);

CREATE INDEX IF NOT EXISTS idx_substack_watched_publications_user_id
    ON substack_watched_publications(user_id);

-- The Celery beat poller scans across all users' watched publications in
-- one pass, oldest-polled-first, so it needs an index that isn't scoped to
-- a single user_id.
CREATE INDEX IF NOT EXISTS idx_substack_watched_publications_poll_order
    ON substack_watched_publications(last_polled_at NULLS FIRST);

ALTER TABLE substack_watched_publications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own watched publications" ON substack_watched_publications;
CREATE POLICY "Users manage own watched publications" ON substack_watched_publications
    FOR ALL USING (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON substack_watched_publications TO authenticated;
GRANT ALL ON substack_watched_publications TO service_role;
