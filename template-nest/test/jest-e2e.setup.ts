// Fallback DATABASE_URL for e2e/coverage runs, matching docker-compose.test.yml.
// An already-set env var (e.g. from CI) always wins.
process.env.DATABASE_URL ??=
  'postgresql://postgres:postgres@localhost:5433/{{project_db}}_test'
