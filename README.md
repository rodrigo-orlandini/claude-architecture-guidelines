# Claude Architecture Guidelines

Kit portátil que aplica, em qualquer projeto novo, a mesma arquitetura e o mesmo fluxo de desenvolvimento assistido por IA — em vez de reconstruir tudo à mão a cada vez, ou copiar e colar pedaços soltos de um projeto antigo.

## A ideia

Depois de montar um monolito modular com Clean Architecture num projeto real (CaseCellShop, TypeScript), mais o conjunto de skills/agentes do Claude Code que sustentam esse padrão em cada sessão (revisão de arquitetura, TDD guiado, checklist de observabilidade), ficou claro que valia a pena extrair isso como kit reutilizável em vez de reconstruir do zero no próximo projeto.

Este repositório é esse kit. Ele empacota três coisas:

1. **Um scaffold de código completo e validado** — não um esqueleto vazio: um módulo de exemplo funcional (entity, value objects, use-cases, repository, HTTP, testes unitários e de integração) que serve de referência para copiar o padrão ao construir o módulo real.
2. **As regras de arquitetura escritas** (`docs/architecture-rules.md`) — o que é permitido, o que não é, e por quê — para que um agente de IA (ou uma pessoa nova no time) não precise adivinhar.
3. **Skills e agentes do Claude Code** que fazem cumprir essas regras durante o desenvolvimento: `session-start` (onboarding), `domain-modeler` (modelagem antes de codar), `tdd-agent` (loop red-green-refactor), `observability-enforcer` (checklist antes de fechar tarefa), `arch-reviewer` (revisão de diff).

Duas variantes de stack hoje, mesmos princípios, mecanismo idiomático de cada linguagem:

| | TypeScript (`template-ts/`) | Go (`template-go/`) |
|---|---|---|
| HTTP | Fastify | `net/http` nativo (`http.ServeMux`, Go 1.22+) |
| Erros de domínio | `Either<DomainError, T>` | `(T, error)`, erro tipado `*httperr.DomainError` |
| DI | tsyringe (container) | wiring manual em `module.go` por módulo |
| Interface de porta | prefixo `I` (`IItemRepository`) | sem prefixo (`ItemRepository`), definida por quem consome |
| Acesso a dados | Prisma | sqlc (SQL tipado, gerado) + pgx |
| Testes de integração | `vitest.integration.ts` + sufixo `.integration-spec.ts` | build tag `//go:build integration` + sufixo `_integration_test.go` |

Em comum às duas:
- **Monolito modular + Clean Architecture** — módulo = bounded context, regra de dependência, ports & adapters
- **Observabilidade desde o dia 1** (correlationId + logger estruturado, métricas Prometheus, OpenTelemetry, stack Grafana)
- **Docker** (dev / test / observability) e **CI** GitHub Actions com coverage ≥ 80%
- Fluxo superpowers (brainstorm → spec → plano → execução → revisão → PR) e registro de prompts

Cada variante já foi validada rodando um agente **sem contexto prévio** aplicando o kit numa pasta vazia, construindo um módulo real do zero e rodando a suíte completa (build, lint, unit, integração contra Postgres real) — duas vezes cada, em domínios diferentes.

## Quick start

**Pré-requisito único:** [Claude Code](https://docs.claude.com/claude-code) instalado. O resto (Node ou Go, Docker, plugins) o próprio bootstrap confere e te avisa do que falta — mas se quiser adiantar, veja [`SETUP.md`](./SETUP.md).

1. Clone este repositório em algum lugar fixo da máquina (não precisa ser dentro do projeto novo):

   ```bash
   git clone https://github.com/rodrigo-orlandini/claude-architecture-guidelines.git ~/claude-architecture-guidelines
   ```

2. Crie a pasta do projeto novo (vazia, ou só com `.git`), abra o Claude Code nela e cole:

   ```
   Leia ~/claude-architecture-guidelines/BOOTSTRAP.md e siga todos os passos para aplicar a estrutura neste projeto.
   Stack: TypeScript | Go. Nome do projeto: <Nome Legível>. Domínio: <uma ou duas frases sobre o que o sistema faz>.
   ```

3. O agente decide a variante (`BOOTSTRAP-TS.md` ou `BOOTSTRAP-GO.md`), copia o template, substitui os placeholders, instala dependências, valida tudo (build + testes, unit e integração contra Postgres real) e conduz um brainstorming curto pra modelar o domínio inicial.

4. No final você tem: projeto rodando, CI configurado, primeiro módulo real implementado seguindo TDD, e `CONTEXT.md` preenchido com o glossário do domínio.

Sem IA, ou pra entender cada passo antes de rodar: siga `BOOTSTRAP-TS.md`/`BOOTSTRAP-GO.md` manualmente — todo passo é comando comum (`cp`, `sed`, `npm`/`go`, `git`).

## Conteúdo

```
_architecture/
├── README.md          ← este arquivo
├── SETUP.md            ← pré-requisitos e configuração da máquina / Claude Code (seções [TS]/[Go] onde divergem)
├── BOOTSTRAP.md         ← dispatcher: qual stack, qual arquivo seguir
├── BOOTSTRAP-TS.md       ← roteiro executável, stack TypeScript
├── BOOTSTRAP-GO.md       ← roteiro executável, stack Go
├── template-ts/          ← arquivos copiados para a raiz do projeto novo (TypeScript, com placeholders)
│   ├── CLAUDE.md, CONTEXT.md, PROMPTS.md, README.md
│   ├── .claude/         ← settings.json (plugins), agents/, skills/
│   ├── docs/            ← architecture.md, adr/, superpowers/{specs,plans}/
│   ├── prompts/         ← convenção de registro de prompts + prompt 00
│   ├── src/             ← shared core + observability + infra http + módulo `example` completo
│   ├── prisma/          ← schema com model de exemplo
│   ├── grafana/, prometheus.yml, docker-compose*.yml, Dockerfile
│   ├── scripts/compose.mjs  ← `docker compose` portátil (nativo ou via WSL)
│   ├── .github/workflows/ci.yml
│   └── package.json, tsconfig*.json, vitest*.ts, .eslintrc.cjs, .env.example, .gitignore
├── template-go/          ← arquivos copiados para a raiz do projeto novo (Go, com placeholders)
│   ├── CLAUDE.md, CONTEXT.md, PROMPTS.md, README.md
│   ├── .claude/         ← settings.json (plugins), agents/, skills/
│   ├── docs/            ← architecture.md, architecture-rules.md, adr/, superpowers/{specs,plans}/
│   ├── prompts/         ← convenção de registro de prompts + prompt 00
│   ├── cmd/api, cmd/migrate  ← bootstrap do processo; migrations via goose (lib, não CLI)
│   ├── internal/platform/    ← config, db (pgxpool), httpserver (net/http + middlewares), httperr, observability
│   ├── internal/modules/example/  ← domain, usecase, adapters/{httpapi,postgres} completos
│   ├── db/{migrations,schema,queries}/, sqlc.yaml
│   ├── grafana/, prometheus.yml, docker-compose*.yml, Dockerfile
│   ├── scripts/compose/  ← `docker compose` portátil (nativo ou via WSL), sem depender de Node
│   ├── .github/workflows/ci.yml
│   └── go.mod, go.sum, Makefile, .env.example, .gitignore
└── reference/casecellshop/  ← material original (somente leitura, exemplo real preenchido, stack TypeScript)
    ├── CONTEXT.md, PROMPTS.md, CLAUDE.md, architecture-rules.md
    ├── prompts/     ← prompts reais 00–06 (inclui 00 que criou esta estrutura e 03 de git/CI)
    ├── docs/        ← specs de design reais + um plano de implementação exemplo
    ├── sdd-ledger-example/  ← exemplo de ledger do subagent-driven-development
    ├── claude/      ← .claude/ original (agents, skills, settings)
    └── ci-original.yml
```

## Placeholders dos templates

| Placeholder | Exemplo | Onde aparece |
|---|---|---|
| `{{PROJECT_NAME}}` | `Task Hub` | docs, skills, agentes, título da API, dashboard |
| `{{project-slug}}` | `task-hub` | nome do pacote/módulo, container names, métricas, tracer |
| `{{project_db}}` | `task_hub` | nomes de banco Postgres (dev/test), CI |
| `{{PROJECT_DESCRIPTION}}` | `API para equipes pequenas gerenciarem tarefas.` | README do projeto |
| `{{module-path}}` **[Go apenas]** | `github.com/acme/task-hub` | `go.mod` e todo import interno |

## Princípios que o kit preserva (nas duas stacks)

1. Módulo = bounded context. Nada cruza módulo sem interface (port).
2. Domínio não conhece infra. Use-cases retornam erro tipado (`Either` em TS, `(T, error)` em Go); controllers/handlers só fazem match.
3. Todo wiring centralizado (`container.ts` em TS, `module.go` em Go). Nada de instanciar adapter concreto fora dali.
4. Teste antes do código, fakes em vez de mocks, integration contra banco real em Docker.
5. Observabilidade é requisito da tarefa, não melhoria posterior.
6. Toda feature: spec → plano → TDD → revisão automatizada → verificação → PR.
7. Decisões e prompts ficam registrados (`docs/superpowers/`, `docs/adr/`, `prompts/`).

## Adicionando uma stack nova

Mesma forma de `template-go/`: pasta `template-<stack>/` com o mesmo módulo de exemplo (VO simples, VO enum com transição, entity com comportamento, create/list/get, mapper, repository real + fake, handler HTTP com teste de rota cobrindo "campo desconhecido no corpo"), `docs/architecture.md` + `docs/architecture-rules.md` adaptados, `.claude/` com os mesmos 4 skills + 2 agentes, e um `BOOTSTRAP-<STACK>.md` novo referenciado pelo dispatcher `BOOTSTRAP.md`. Valide sempre com um agente sem contexto aplicando o kit numa pasta vazia — as duas variantes atuais só chegaram a zero atrito depois de duas rodadas de teste cada.
