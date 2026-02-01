\set pguser `echo "${POSTGRES_USER:?POSTGRES_USER is required}"`

CREATE DATABASE _supabase WITH OWNER :pguser;
