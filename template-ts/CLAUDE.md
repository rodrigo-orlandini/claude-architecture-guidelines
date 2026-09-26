# {{PROJECT_NAME}}

Monolito modular com Clean Architecture (TypeScript + Fastify + tsyringe + Prisma + Vitest).
Cada módulo em `src/modules/<módulo>/` é um bounded context extraível como microsserviço sem retrabalho.

## Leitura obrigatória antes de codar

- `CONTEXT.md` — glossário de domínio (nomes de entidades, módulos, invariantes)
- `src/shared/core/architecture-rules.md` — regras invioláveis de camada, Either, DI, nomenclatura, testes, observabilidade
- `docs/architecture.md` — design completo da estrutura
- Módulo de referência: `src/modules/example/` enquanto existir; depois de removido, o módulo real mais completo em `src/modules/` — copie o padrão dele

## Fluxo de desenvolvimento

Início de sessão: invoque a skill `session-start`.

```
brainstorming (superpowers) → spec em docs/superpowers/specs/
  → writing-plans → plano em docs/superpowers/plans/
  → domain-modeler (entities / VOs)
  → tdd-agent (red → green → refactor por use-case)
  → observability-enforcer
  → arch-reviewer (diff)
  → verification-before-completion
  → commit + PR
```

Passos que pedem aprovação (brainstorming, domain-modeler, planos) exigem resposta do usuário. Em execução autônoma, sem ninguém para responder: decida pela opção mais simples compatível com `CONTEXT.md`, registre cada decisão numa seção **Premissas** da spec e siga; nunca invente requisito novo.

## Git

- Toda tarefa nova: branch nova a partir de `origin/main` (`feat/<nome>`, `fix/<nome>`, `docs/<nome>`).
- Commits em Conventional Commits (`feat(módulo): ...`, `fix(módulo): ...`).
- Conclusão da tarefa: abrir PR para `main` (`gh pr create`). CI precisa passar (build → unit + integration → coverage 80%).

## Prompts

Salve todo prompt relevante em `prompts/`. Veja `prompts/CLAUDE.md` para convenção de nomes e estrutura. Atualize o índice em `PROMPTS.md`.

## Comandos

- `npm run typecheck` — tsc sem emitir (código + specs)
- `npm run lint` — eslint (`no-console` ativo)
- `npm run test:unit` — unit (sem I/O)
- `npm run test:integration` — sobe `docker-compose.test.yml`, recria schema no banco de teste, roda `*.integration-spec.ts`
- `npm run test:coverage` — unit + integration com coverage combinado (threshold 80%)
- `npm run db:migrate` — prisma migrate dev
- `npm run dev` — app + Postgres + Redis em containers
- `node scripts/compose.mjs <args>` — `docker compose` portátil (usa `wsl docker` automaticamente no Windows sem Docker Desktop)
- `node scripts/compose.mjs -f docker-compose.observability.yml up -d` — Prometheus, Grafana, Loki, Tempo
