# Database migrations

VetHelp uses `node-pg-migrate` with raw PostgreSQL DDL stored in `migrations/node-pg`.

## Commands

```bash
DATABASE_URL=postgres://vethelp:vethelp@localhost:5432/vethelp npm run migrate:up
DATABASE_URL=postgres://vethelp:vethelp@localhost:5432/vethelp npm run migrate:verify
npm run migrate:create -- add_feature_name
npm run migrate:down -- --count 1
```

`node-pg-migrate` reads `DATABASE_URL` directly. This repository intentionally has no `database.json`: it would not be consumed by the tool and would become misleading dead configuration.

The runner records applied migrations in `public.schema_migrations`. `node-pg-migrate` does not natively persist source checksums, so `migrate:up` also records SHA-256 values in `public.schema_migration_checksums`; `migrate:verify` fails if an existing migration file has changed or disappeared.

## Existing environments

The two baseline migrations are for clean databases. An environment created by the former SQL runner must be adopted deliberately: back up the database, review schema drift, then register the baseline only after confirming the tables match. Do not run destructive down migrations against shared environments.
