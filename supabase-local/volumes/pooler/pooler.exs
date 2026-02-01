{:ok, _} = Application.ensure_all_started(:supavisor)

# Safely parse PostgreSQL version with error handling
version =
  case Supavisor.Repo.query!("select version()") do
    %{rows: [[ver]]} ->
      case Supavisor.Helpers.parse_pg_version(ver) do
        {:ok, v} -> v
        _ -> 
          IO.puts("Warning: Could not parse PostgreSQL version from: #{ver}")
          "15.0.0"  # Default fallback
      end
    result ->
      IO.puts("Warning: Unexpected query result: #{inspect(result)}")
      "15.0.0"  # Default fallback
  end

# Helper to parse integer env vars with defaults
parse_int = fn key, default ->
  case System.get_env(key) do
    nil -> default
    "" -> default
    val ->
      case Integer.parse(val) do
        {int, _} -> int
        :error -> default
      end
  end
end

params = %{
  "external_id" => System.get_env("POOLER_TENANT_ID"),
  "db_host" => "db",
  "db_port" => parse_int.("POSTGRES_PORT", 5432),
  "db_database" => System.get_env("POSTGRES_DB"),
  "require_user" => false,
  "auth_query" => "SELECT * FROM pgbouncer.get_auth($1)",
  "default_max_clients" => parse_int.("POOLER_MAX_CLIENT_CONN", 100),
  "default_pool_size" => parse_int.("POOLER_DEFAULT_POOL_SIZE", 20),
  "default_parameter_status" => %{"server_version" => version},
  "users" => [%{
    "db_user" => "pgbouncer",
    "db_password" => System.get_env("POSTGRES_PASSWORD"),
    "mode_type" => System.get_env("POOLER_POOL_MODE"),
    "pool_size" => parse_int.("POOLER_DEFAULT_POOL_SIZE", 20),
    "is_manager" => true
  }]
}

if !Supavisor.Tenants.get_tenant_by_external_id(params["external_id"]) do
  case Supavisor.Tenants.create_tenant(params) do
    {:ok, tenant} ->
      IO.puts("Created tenant: #{params["external_id"]}")
    {:error, reason} ->
      IO.puts("Error creating tenant #{params["external_id"]}: #{inspect(reason)}")
  end
end
