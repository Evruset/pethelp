# VetHelp Alpha PostgreSQL Backup / Restore Runbook

## Purpose and scope

This runbook covers a logical, transactionally consistent PostgreSQL backup for the Alpha environment and an isolated restore rehearsal.

Required application schemas:

- `identity_schema`
- `pet_schema`
- `booking_schema`

`public` is included solely because `node-pg-migrate` records migration history in `public.schema_migrations` and migration checksums in `public.schema_migration_checksums`.

> Do not restore directly into the active Alpha database. Always restore into an isolated database first.

## Targets

- RPO: no more than 5 minutes.
- RTO: no more than 60 minutes.
- Run this procedure before every migration and after every material schema change.

## Prerequisites

```bash
kubectl version --client
pg_dump --version
pg_restore --version
psql --version
```

The active runtime secret must already be materialized by the approved Secret Manager integration:

```bash
kubectl -n vethelp-alpha get secret vethelp-backend-secret
```

## 1. Create an atomic logical backup

`--single-transaction` gives `pg_dump` a consistent snapshot. `--serializable-deferrable` avoids a non-serializable snapshot when the target database supports it.

```bash
set -euo pipefail

NAMESPACE="vethelp-alpha"
SECRET_NAME="vethelp-backend-secret"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
BACKUP_FILE="vethelp-alpha-${TIMESTAMP}.dump"

DATABASE_URL="$(
  kubectl -n "${NAMESPACE}" get secret "${SECRET_NAME}" \
    -o jsonpath='{.data.DATABASE_URL}' | base64 -d
)"

pg_dump "${DATABASE_URL}" \
  --format=custom \
  --verbose \
  --no-owner \
  --no-acl \
  --single-transaction \
  --serializable-deferrable \
  --schema=identity_schema \
  --schema=pet_schema \
  --schema=booking_schema \
  --schema=public \
  --file="${BACKUP_FILE}"

sha256sum "${BACKUP_FILE}" > "${BACKUP_FILE}.sha256"
printf 'Created %s\n' "${BACKUP_FILE}"
```

Store the dump and its SHA-256 file in the approved encrypted backup storage. Do not upload dumps to an issue tracker, chat, or a public CI artifact.

## 2. In-cluster backup option

Use this only when the operator workstation cannot connect to Alpha PostgreSQL.

```bash
set -euo pipefail

NAMESPACE="vethelp-alpha"
SECRET_NAME="vethelp-backend-secret"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
BACKUP_FILE="vethelp-alpha-${TIMESTAMP}.dump"

DATABASE_URL="$(
  kubectl -n "${NAMESPACE}" get secret "${SECRET_NAME}" \
    -o jsonpath='{.data.DATABASE_URL}' | base64 -d
)"

kubectl -n "${NAMESPACE}" run "pg-backup-${TIMESTAMP}" \
  --rm -i --restart=Never \
  --image=postgres:16-alpine \
  --env="DATABASE_URL=${DATABASE_URL}" \
  --command -- sh -ceu '
    pg_dump "$DATABASE_URL" \
      --format=custom \
      --verbose \
      --no-owner \
      --no-acl \
      --single-transaction \
      --serializable-deferrable \
      --schema=identity_schema \
      --schema=pet_schema \
      --schema=booking_schema \
      --schema=public
  ' > "${BACKUP_FILE}"

sha256sum "${BACKUP_FILE}" > "${BACKUP_FILE}.sha256"
printf 'Created %s\n' "${BACKUP_FILE}"
```

## 3. Restore rehearsal into an isolated database

Set `RESTORE_DATABASE_URL` to a newly created database, never to the running Alpha database.

```bash
set -euo pipefail

BACKUP_FILE="${1:?Usage: ./restore-check.sh vethelp-alpha-YYYYMMDDTHHMMSSZ.dump}"
: "${RESTORE_DATABASE_URL:?Set RESTORE_DATABASE_URL for the isolated restore database}"

sha256sum -c "${BACKUP_FILE}.sha256"

pg_restore \
  --verbose \
  --clean \
  --if-exists \
  --no-owner \
  --no-acl \
  --dbname="${RESTORE_DATABASE_URL}" \
  "${BACKUP_FILE}"
```

## 4. Mandatory migration-history verification

The restore is not accepted until the migration ledger exists and contains the expected rows.

```bash
psql "${RESTORE_DATABASE_URL}" -v ON_ERROR_STOP=1 <<'SQL'
SELECT COUNT(*) AS applied_migrations
FROM public.schema_migrations;

SELECT *
FROM public.schema_migrations
ORDER BY run_on DESC
LIMIT 20;

SELECT *
FROM public.schema_migration_checksums
ORDER BY migration_name
LIMIT 20;
SQL
```

When the repository checkout is available, verify the restored ledger against migration files:

```bash
cd backend
DATABASE_URL="${RESTORE_DATABASE_URL}" npm run migrate:verify
```

## 5. Smoke checks

```bash
psql "${RESTORE_DATABASE_URL}" -v ON_ERROR_STOP=1 <<'SQL'
SELECT current_database() AS database_name, clock_timestamp() AS verified_at;

SELECT schema_name
FROM information_schema.schemata
WHERE schema_name IN ('identity_schema', 'pet_schema', 'booking_schema', 'public')
ORDER BY schema_name;

SELECT COUNT(*) AS applied_migrations
FROM public.schema_migrations;
SQL
```

## 6. Incident restore checklist

1. Assign an incident identifier and freeze non-essential changes.
2. Disable write traffic at the gateway before recovery.
3. Create an emergency backup of the current state, even when it is suspected to be inconsistent.
4. Restore the last known-good dump into an isolated database.
5. Complete sections 4 and 5 of this runbook.
6. Record actual RPO/RTO, missing events, and validation results in the incident timeline.
7. Only after an incident commander approves, switch application traffic to the restored target.
8. Run `npm run migrate:verify` and verify `GET /v1/health` before enabling writes.
