# {{PROJECT_NAME}}

Monolito modular com Clean Architecture em Go (net/http nativo + sqlc + pgx + Postgres).
Cada módulo em `internal/modules/<módulo>/` é um bounded context extraível como microsserviço sem retrabalho.

## Leitura obrigatória antes de codar

- `CONTEXT.md` — glossário de domínio (nomes de entidades, módulos, invariantes)
- `docs/architecture-rules.md` — regras invioláveis de camada, erros, DI manual, nomenclatura, testes, observabilidade
- `docs/architecture.md` — design completo da estrutura
- Módulo de referência: `internal/modules/example/` enquanto existir; depois de removido, o módulo real mais completo em `internal/modules/` — copie o padrão dele

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

- `go build ./...` — compila tudo
- `go vet ./...` / `gofmt -l .` — lint (sem tool externa; golangci-lint é opcional, ver SETUP.md)
- `go test ./...` — unit (sem I/O)
- `go run ./cmd/migrate up` — aplica migrations no banco apontado por `DATABASE_URL`
- `go test -tags=integration ./...` — roda contra `docker-compose.test.yml` (rode `go run ./cmd/migrate up` antes)
- `bash scripts/check-coverage.sh 80 coverage.out` — checa threshold sobre `internal/modules/...`
- `go run ./cmd/api` — sobe a API localmente
- `go run ./scripts/compose -- <args>` — `docker compose` portátil; usa `wsl docker compose` automaticamente no Windows sem Docker Desktop (não precisa de Node, só do toolchain Go já exigido)
- `go run ./scripts/compose -- up -d postgres` — sobe só o Postgres de dev
- `go run ./scripts/compose -- -f docker-compose.observability.yml up -d` — Prometheus, Grafana, Loki, Tempo
- `make <alvo>` — atalhos para os comandos acima via `Makefile`, se `make` estiver disponível (opcional; todo alvo tem o comando `go`/`docker` equivalente documentado acima)
