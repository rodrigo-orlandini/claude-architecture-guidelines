# {{PROJECT_NAME}}

{{PROJECT_DESCRIPTION}}

Modular monolith with Clean Architecture — see [`docs/architecture.md`](./docs/architecture.md).

## Prerequisites

- Node.js 22+
- Docker + Docker Compose

## Running

```bash
cp .env.example .env
npm install
npx prisma generate
npm run infra:up               # Postgres + Redis (native docker or via WSL, see scripts/compose.mjs)
npm run db:migrate              # applies migrations to the dev database
npm run dev:local               # or: npm run dev (app also in a container)
```

- API: http://localhost:3000
- Swagger: http://localhost:3000/docs
- Health: http://localhost:3000/health
- Metrics: http://localhost:3000/metrics

## Tests

```bash
npm run typecheck
npm run test:unit
npm run test:integration   # brings up docker-compose.test.yml
npm run test:coverage      # unit + integration, threshold 80%
```

## Observability

```bash
node scripts/compose.mjs -f docker-compose.observability.yml up -d
```

Grafana at http://localhost:3001 (Prometheus, Loki, and Tempo provisioned).

## Documentation

- [`CONTEXT.md`](./CONTEXT.md) — domain glossary
- [`docs/architecture.md`](./docs/architecture.md) — architecture and development flow
- [`src/shared/core/architecture-rules.md`](./src/shared/core/architecture-rules.md) — review rules
- [`PROMPTS.md`](./PROMPTS.md) — AI prompts used during development
