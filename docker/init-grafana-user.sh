#!/bin/bash
set -e

GRAFANA_PG_PASS="${GRAFANA_PG_PASSWORD:-grafana_reader_pass}"

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
  DO \$\$
  BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'grafana_reader') THEN
      CREATE USER grafana_reader WITH PASSWORD '${GRAFANA_PG_PASS}';
    END IF;
  END
  \$\$;

  GRANT CONNECT ON DATABASE ${POSTGRES_DB} TO grafana_reader;
  GRANT USAGE ON SCHEMA public TO grafana_reader;
  GRANT SELECT ON ALL TABLES IN SCHEMA public TO grafana_reader;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO grafana_reader;
EOSQL
