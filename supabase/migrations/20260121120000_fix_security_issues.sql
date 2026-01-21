-- Secure profiles table by denying anonymous access
create policy "Deny anonymous access"
on profiles
for select
to anon
using (false);

-- Secure auth_attempts table
alter table auth_attempts enable row level security;

create policy "Deny all access to auth_attempts"
on auth_attempts
for all
to public
using (false);

-- Allow users to update their own resume analyses
create policy "Users can update own analyses"
on resume_analyses
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
