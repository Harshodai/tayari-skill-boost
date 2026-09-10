CREATE TABLE IF NOT EXISTS cover_letters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    job_title TEXT,
    company_name TEXT,
    content TEXT NOT NULL,
    job_url TEXT,
    resume_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_cover_letters_user_id ON cover_letters(user_id);
ALTER TABLE cover_letters ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own cover letters" ON cover_letters;
CREATE POLICY "Users can manage own cover letters" ON cover_letters
    FOR ALL USING (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON cover_letters TO authenticated;
GRANT ALL ON cover_letters TO service_role;
