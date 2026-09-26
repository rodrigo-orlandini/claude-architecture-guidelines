# AI Prompts

The prompts used in developing the reference project are documented in [`prompts/`](./prompts/).

Each file records:
- **Goal** — what the prompt solves or produces
- **Context** — where and why it was used
- **Prompt** — exact text sent to the AI
- **Steering criteria** — engineering decisions behind the prompt
- **Result** — what was produced and a critical assessment

## Index

| # | File | Topic |
|---|---|---|
| 00 | [estrutura-arquitetural-e-fluxo-de-desenvolvimento](./prompts/00-estrutura-arquitetural-e-fluxo-de-desenvolvimento.md) | Initial architecture and assisted development workflow |
| 01 | [vitrine-inicial](./prompts/01-vitrine-inicial.md) | GET /products endpoint, Prisma schema, Fastify controller |
| 02 | [erp-sync](./prompts/02-erp-sync.md) | Sync with fake ERP via HTTP polling |
| 03 | [git-workflow-e-ci](./prompts/03-git-workflow-e-ci.md) | Git workflow with feature branches and GitHub Actions pipeline |
| 04 | [cache-vitrine](./prompts/04-cache-vitrine.md) | In-process L1 cache + Redis L2 with LFU eviction |
| 05 | [checkout-assincrono](./prompts/05-checkout-assincrono.md) | Checkout with Outbox Pattern, soft reservation, BullMQ worker |
| 06 | [observabilidade](./prompts/06-observabilidade.md) | OpenTelemetry, prom-client, local Prometheus/Grafana/Loki/Tempo stack |
