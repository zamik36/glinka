#!/bin/bash
# Creates a read-only PostgreSQL user for Grafana dashboards.
# Executed by PostgreSQL on first container init via /docker-entrypoint-initdb.d/ mount.
set -euo pipefail

: "${GRAFANA_PG_USER:=grafana_reader}"
: "${GRAFANA_PG_PASSWORD:?GRAFANA_PG_PASSWORD must be set}"

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-SQL
    DO \$\$
    BEGIN
        IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = '${GRAFANA_PG_USER}') THEN
            CREATE USER ${GRAFANA_PG_USER} WITH PASSWORD '${GRAFANA_PG_PASSWORD}';
        END IF;
    END
    \$\$;

    GRANT CONNECT ON DATABASE ${POSTGRES_DB} TO ${GRAFANA_PG_USER};
    GRANT USAGE ON SCHEMA public TO ${GRAFANA_PG_USER};
    GRANT SELECT ON ALL TABLES IN SCHEMA public TO ${GRAFANA_PG_USER};
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO ${GRAFANA_PG_USER};
SQL
