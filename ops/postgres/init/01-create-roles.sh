#!/bin/sh
set -eu

read_secret() {
  secret_path="$1"
  if [ -z "$secret_path" ] || [ ! -s "$secret_path" ]; then
    echo "required PostgreSQL role secret is unavailable" >&2
    exit 78
  fi
  cat "$secret_path"
}

migrator_password="$(read_secret "${POSTGRES_MIGRATOR_PASSWORD_FILE:-}")"
app_password="$(read_secret "${POSTGRES_APP_PASSWORD_FILE:-}")"
backup_password="$(read_secret "${POSTGRES_BACKUP_PASSWORD_FILE:-}")"
export PGPASSWORD="${POSTGRES_PASSWORD:?POSTGRES_PASSWORD must be loaded by the official entrypoint}"

psql --set=ON_ERROR_STOP=1 \
  --username "$POSTGRES_USER" \
  --dbname "$POSTGRES_DB" \
  --set=db_name="$POSTGRES_DB" \
  --set=migrator_user="$POSTGRES_MIGRATOR_USER" \
  --set=migrator_password="$migrator_password" \
  --set=app_user="$POSTGRES_APP_USER" \
  --set=app_password="$app_password" \
  --set=backup_user="$POSTGRES_BACKUP_USER" \
  --set=backup_password="$backup_password" <<'SQL'
SELECT format(
  'CREATE ROLE %I LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT',
  :'migrator_user',
  :'migrator_password'
)
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'migrator_user')
\gexec

SELECT format('ALTER ROLE %I PASSWORD %L', :'migrator_user', :'migrator_password')
\gexec

SELECT format(
  'CREATE ROLE %I LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT',
  :'app_user',
  :'app_password'
)
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'app_user')
\gexec

SELECT format('ALTER ROLE %I PASSWORD %L', :'app_user', :'app_password')
\gexec

SELECT format(
  'CREATE ROLE %I LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE INHERIT',
  :'backup_user',
  :'backup_password'
)
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'backup_user')
\gexec

SELECT format('ALTER ROLE %I PASSWORD %L', :'backup_user', :'backup_password')
\gexec
SELECT format('ALTER ROLE %I INHERIT', :'backup_user')
\gexec

SELECT format('ALTER DATABASE %I OWNER TO %I', :'db_name', :'migrator_user')
\gexec

CREATE EXTENSION IF NOT EXISTS vector;

SELECT format('ALTER SCHEMA public OWNER TO %I', :'migrator_user')
\gexec

REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT CONNECT ON DATABASE :"db_name" TO :"migrator_user", :"app_user", :"backup_user";
GRANT USAGE ON SCHEMA public TO :"app_user", :"backup_user";
GRANT pg_read_all_data TO :"backup_user";

ALTER DEFAULT PRIVILEGES FOR ROLE :"migrator_user" IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO :"app_user";
ALTER DEFAULT PRIVILEGES FOR ROLE :"migrator_user" IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO :"app_user";
ALTER DEFAULT PRIVILEGES FOR ROLE :"migrator_user" IN SCHEMA public
  GRANT EXECUTE ON FUNCTIONS TO :"app_user";

SELECT format('ALTER ROLE %I SET statement_timeout = %L', :'app_user', '30s')
\gexec
SELECT format('ALTER ROLE %I SET idle_in_transaction_session_timeout = %L', :'app_user', '15s')
\gexec
SQL
