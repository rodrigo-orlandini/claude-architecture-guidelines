-- Schema fed to sqlc for type inference. Kept in sync with
-- db/migrations/00001_init.sql by hand — sqlc does not read migrations
-- directly in this config (see sqlc.yaml), so a schema change always touches
-- both files. Domain enums are TEXT columns validated by the Go domain
-- package (see docs/architecture-rules.md) — never a native Postgres enum.
CREATE TABLE items (
    id         TEXT PRIMARY KEY,
    name       TEXT NOT NULL,
    status     TEXT NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
