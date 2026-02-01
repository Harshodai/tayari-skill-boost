\set pguser `echo "${POSTGRES_USER:?POSTGRES_USER is required}"`

\c _supabase
create schema if not exists _analytics;
alter schema _analytics owner to :pguser;
\c postgres
