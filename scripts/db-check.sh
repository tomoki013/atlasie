#!/usr/bin/env bash
set -euo pipefail
: "${MIGRATION_DATABASE_URL:?Set MIGRATION_DATABASE_URL to an isolated test database}"
for migration in db/migrations/*.sql; do
 psql "$MIGRATION_DATABASE_URL" -v ON_ERROR_STOP=1 -f "$migration"
done
psql "$MIGRATION_DATABASE_URL" -v ON_ERROR_STOP=1 -f db/seeds/001_countries_places.sql
psql "$MIGRATION_DATABASE_URL" -v ON_ERROR_STOP=1 -f infra/api-role.sql
psql "$MIGRATION_DATABASE_URL" -v ON_ERROR_STOP=1 -f db/tests/security.sql
