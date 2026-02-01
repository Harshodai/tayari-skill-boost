-- Tayari Skill Boost - Development Schema
-- This file mirrors the main schema for local development

create table profiles (
  id uuid references auth.users not null,
  updated_at timestamp with time zone,
  created_at timestamp with time zone default now(),
  username text,
  full_name text,
  email text,
  avatar_url text,
  website text,

  primary key (id),
  unique(username),
  constraint username_length check (char_length(username) >= 3 OR username IS NULL)
);

alter table profiles enable row level security;

create policy "Users can view their own profile"
  on profiles for select
  using ( auth.uid() = id );

create policy "Users can insert their own profile."
  on profiles for insert
  with check ( auth.uid() = id );

create policy "Users can update own profile."
  on profiles for update
  using ( auth.uid() = id );

-- Set up Realtime
begin;
  drop publication if exists supabase_realtime;
  create publication supabase_realtime;
commit;
alter publication supabase_realtime add table profiles;

-- Set up Storage
insert into storage.buckets (id, name)
values ('avatars', 'avatars');

create policy "Avatar images are publicly accessible."
  on storage.objects for select
  using ( bucket_id = 'avatars' );

-- Users can only upload to their own folder
create policy "Users can upload their own avatar."
  on storage.objects for insert
  with check ( bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1] );

-- Users can only update their own avatar
create policy "Users can update their own avatar."
  on storage.objects for update
  using ( bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1] );
