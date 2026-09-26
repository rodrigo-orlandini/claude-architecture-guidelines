# {{PROJECT_NAME}}

{{PROJECT_DESCRIPTION}}

Monolito modular com Clean Architecture — ver [`docs/architecture.md`](./docs/architecture.md).

## Pré-requisitos

- Node.js 22+
- Docker + Docker Compose

## Rodando

```bash
cp .env.example .env
npm install
npx prisma generate
npm run infra:up               # Postgres + Redis (docker nativo ou via WSL, ver scripts/compose.mjs)
npm run db:migrate              # aplica migrations no banco de dev
npm run dev:local               # ou: npm run dev (app também em container)
```

- API: http://localhost:3000
- Swagger: http://localhost:3000/docs
- Health: http://localhost:3000/health
- Métricas: http://localhost:3000/metrics

## Testes

```bash
npm run typecheck
npm run test:unit
npm run test:integration   # sobe docker-compose.test.yml
npm run test:coverage      # unit + integration, threshold 80%
```

## Observabilidade

```bash
node scripts/compose.mjs -f docker-compose.observability.yml up -d
```

Grafana em http://localhost:3001 (Prometheus, Loki e Tempo provisionados).

## Documentação

- [`CONTEXT.md`](./CONTEXT.md) — glossário de domínio
- [`docs/architecture.md`](./docs/architecture.md) — arquitetura e fluxo de desenvolvimento
- [`src/shared/core/architecture-rules.md`](./src/shared/core/architecture-rules.md) — regras de revisão
- [`PROMPTS.md`](./PROMPTS.md) — prompts de IA usados no desenvolvimento
