# Database migrations

VetHelp uses `node-pg-migrate` with raw PostgreSQL DDL stored in `migrations/node-pg`.

## Commands

```bash
DATABASE_URL=postgres://vethelp:vethelp@localhost:5432/vethelp npm run migrate:up
DATABASE_URL=postgres://vethelp:vethelp@localhost:5432/vethelp npm run migrate:verify
npm run migrate:create -- add_feature_name
npm run migrate:down -- --count 1
```

`node-pg-migrate` reads the connection string from `DATABASE_URL`. `database.json` documents the migration directory plus the `public.schema_migrations` history table; command scripts remain explicit about those values to keep local and CI execution deterministic.

The runner records applied migrations in `public.schema_migrations`. `node-pg-migrate` does not natively persist source checksums, so `migrate:up` also records SHA-256 values in `public.schema_migration_checksums`; `migrate:verify` fails if an existing migration file has changed or disappeared.

## Existing environments

The two baseline migrations are for clean databases. An environment created by the former SQL runner must be adopted deliberately: back up the database, review schema drift, then register the baseline only after confirming the tables match. Do not run destructive down migrations against shared environments.

## Forward-only rollback guards

Some migrations create data contracts that are not safely reversible after real writes. For those migrations, prefer a forward corrective migration over editing an already-applied migration file.

`1719330000000_harden_telemed_payment_attempts.js` adds `telemed_schema.telemed_payment_intents.payment_attempt_no` and allows multiple payment attempts per telemedicine case. Dropping that column after a case has more than one attempt would collapse attempt identity and make payment audit/reconciliation ambiguous.

`1719350000000_guard_telemed_payment_attempts_rollback.js` documents that contract in database comments and blocks rollback past the guard when multiple attempts exist. If rollback is required in an environment with multiple attempts, restore from a verified backup or apply a new forward migration that preserves attempt identity.
