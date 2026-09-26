# BOOTSTRAP-GO — aplicar a estrutura Go em um projeto novo

> Stack Go (net/http nativo + sqlc + pgx + Postgres). Para TypeScript, use `BOOTSTRAP-TS.md`.

Roteiro executável. Escrito para um agente de IA sem contexto prévio, mas qualquer pessoa pode seguir.

- `$KIT` = pasta onde está este arquivo (a pasta `_architecture/` cujo caminho foi passado no prompt).
- `$DEST` = raiz do projeto novo = diretório de trabalho atual.

Entradas (pergunte ao usuário se faltarem; em execução autônoma, derive):
- **Nome legível** → `{{PROJECT_NAME}}` (ex.: `Clinic Booking`)
- **Slug kebab-case** → `{{project-slug}}` (ex.: `clinic-booking`; derive do nome)
- **Nome de banco snake_case** → `{{project_db}}` (ex.: `clinic_booking`; slug com `-` trocado por `_`)
- **Módulo Go** → `{{module-path}}` (ex.: `github.com/acme/clinic-booking`; pergunte a org/conta, ou use `github.com/<usuário-git>/<slug>` se não houver preferência)
- **Descrição do domínio** (1–3 frases) — usada no passo 7; a primeira frase vira `{{PROJECT_DESCRIPTION}}` (README do projeto)

**Modo autônomo** (ninguém disponível para responder perguntas ou aprovar): em todo ponto que pede resposta/aprovação do usuário, escolha a opção mais simples compatível com a descrição do domínio, registre a decisão numa seção **Premissas** da spec (passo 7) e siga. Nunca invente requisito que a descrição não sugere.

---

## Passo 0 — Pré-requisitos

Confira `$KIT/SETUP.md` §1–2. Mínimo: `go version` (≥ 1.26, arquitetura `amd64` — confira com `go env GOARCH`), `git --version`. Docker só é necessário para `go test -tags=integration` e dev em containers; sem ele, build/vet/unit tests continuam funcionando. `sqlc` só é necessário se for mudar schema/query (o código gerado já vem commitado no template).

## Passo 1 — Verificar destino

- Se `$DEST` já tem `go.mod`, `internal/` ou `.claude/`, **pare e pergunte** antes de sobrescrever. Este kit é para projeto novo; em projeto existente, faça merge manual arquivo a arquivo.
- Pasta vazia ou só com `.git`/README: prossiga.

## Passo 2 — Copiar o template

Copie **todo** o conteúdo de `$KIT/template-go/`, incluindo dotfiles (`.claude/`, `.github/`, `.env.example`, `.gitignore`):

```bash
cp -r "$KIT/template-go/." "$DEST/"
```

Não copie `$KIT/reference/` nem os `.md` da raiz do kit.

## Passo 3 — Substituir placeholders

Em todos os arquivos copiados (inclusive `.claude/`, `.github/`, `grafana/`, e **os `.go` — o placeholder vive dentro da string do import path, é sintaticamente válido até ser trocado**). No Windows rode em Git Bash:

```bash
grep -rl --exclude-dir=.git -e '{{module-path}}' -e '{{PROJECT_NAME}}' -e '{{project-slug}}' -e '{{project_db}}' -e '{{PROJECT_DESCRIPTION}}' . \
  | xargs sed -i -e 's#{{module-path}}#github.com/acme/clinic-booking#g' \
                 -e 's/{{PROJECT_NAME}}/Clinic Booking/g' \
                 -e 's/{{project-slug}}/clinic-booking/g' \
                 -e 's/{{project_db}}/clinic_booking/g' \
                 -e 's/{{PROJECT_DESCRIPTION}}/API de agendamento para clinicas pequenas./g'
```

Ajuste os valores de exemplo acima para os reais. Se a descrição tiver `/` ou `&`, escape-os no `sed` ou edite `README.md` à mão.

**`{{route}}`** em `grafana/provisioning/dashboards/app.json` (se existir) é sintaxe do Grafana — não é um placeholder do kit, não substitua.

Verifique: `grep -rn '{{PROJECT_NAME}}\|{{project-slug}}\|{{project_db}}\|{{module-path}}\|{{PROJECT_DESCRIPTION}}' .` deve voltar vazio.

## Passo 4 — Dependências

```bash
cp .env.example .env
go mod download
go build ./...
```

Se `go mod download`/`go build` reclamar de checksum, rode `go mod tidy` uma vez (baixa e resolve tudo de novo com o `{{module-path}}` já substituído) e confira que `go.sum` não mudou de forma inesperada.

## Passo 5 — Validar o template (antes de mudar qualquer coisa)

```bash
go build ./...
go vet ./...
test -z "$(gofmt -l .)"
go test ./...
```

Todos devem passar. Com Docker disponível, também:

```bash
go run ./scripts/compose -- -f docker-compose.test.yml up -d --wait
go run ./cmd/migrate up          # DATABASE_URL deve apontar pro banco de teste — ver .env.example / TEST_DATABASE_URL
go test -tags=integration ./...
```

Se algo falhar por defeito do kit, corrija no projeto e **informe o usuário** qual arquivo do kit precisou de ajuste.

## Passo 6 — Commit inicial

```bash
git init -b main          # se ainda não for repositório
git add .
git commit -m "chore: bootstrap modular monolith architecture (go)"
```

Não faça push nem crie repositório remoto sem o usuário pedir (`SETUP.md` §5).

## Passo 7 — Domínio

Com usuário presente: invoque `superpowers:brainstorming` com a descrição do domínio.
Modo autônomo: não invoque a skill (ela depende de perguntas); faça a versão curta abaixo você mesmo.

Defina:
- módulos (bounded contexts) e a responsabilidade de cada um
- entidades, value objects e invariantes
- fluxos principais (endpoints)
- qual módulo implementar primeiro (o mais central do domínio)

Entregáveis:
1. `CONTEXT.md` preenchido: substitua as linhas de exemplo, mantenha as seções. As linhas marcadas "(exemplo)" do módulo `example` saem no passo 8.
2. Spec em `docs/superpowers/specs/AAAA-MM-DD-dominio-inicial-design.md` com: contexto, módulos, entidades/VOs/invariantes, endpoints, **Premissas** (decisões tomadas sem confirmação), fora de escopo.
3. `prompts/00-estrutura-arquitetural.md`: seção **Prompt** = texto exato que iniciou este bootstrap; seção **Resultado** = o que foi gerado até aqui (complete no passo 9).
4. `prompts/01-dominio-inicial.md` no mesmo formato, registrando o brainstorming de domínio.
5. `PROMPTS.md`: adicione a linha 01 no índice.
6. Commit: `docs: domain model and initial spec`.

Referência de projeto real preenchido (kit TS, mesmo processo): `$KIT/reference/casecellshop/`.

## Passo 8 — Primeiro módulo real e remoção do `example`

Implemente **só o primeiro módulo** agora (os demais seguem o fluxo normal de feature, um por branch). Comece numa branch: `git switch -c feat/<modulo>` (ainda não há `origin/main`; parta do `main` local).

Se o módulo central depende de módulos que ainda não existem (ex.: agendamento → paciente), guarde só o id opaco (string, sem FK nem validação) e registre como premissa — ver `docs/architecture-rules.md`, seção "Tratamento de erros".

Espelhe `internal/modules/example/`: mesmos pacotes, padrões e tipos de teste. Arquivos de referência por necessidade:

| Precisa de | Copie o padrão de |
|---|---|
| VO simples com validação | `domain/item_name.go` |
| Enum / máquina de estados | `domain/item_status.go` + `Item.Archive()` em `domain/item.go` |
| Criação (POST, 201, corpo rejeitando campo desconhecido) | `usecase/create_item.go` + `adapters/httpapi/item_handler.go` (`json.Decoder.DisallowUnknownFields()`) |
| Leitura por id com 404 | `usecase/get_item.go` + `domain/errors.go` |
| Listagem paginada | `usecase/list_items.go` |
| Persistência | `db/schema/example/`, `db/queries/example/`, `sqlc.yaml` (adicione uma entrada), `adapters/postgres/item_repository.go` + `mapper.go` (+ integration test) |
| Migration | `db/migrations/NNNNN_<nome>.sql` com marcadores `-- +goose Up` / `-- +goose Down` |
| Wiring | `module.go` (só ele conhece `adapters/httpapi` e `adapters/postgres` ao mesmo tempo) |
| Teste HTTP (status, DTO, 400 para campo extra) | `adapters/httpapi/item_handler_integration_test.go` (`httptest.NewServer` + wiring real) |
| Id de negócio nos logs | `observability.AddFields` em `usecase/create_item.go` |
| Invariante garantida pelo banco sob concorrência | `adapters/postgres/errors.go` (comentário `isUniqueViolation`) |

Depois de escrever schema/queries novos, rode `sqlc generate` (ou `make sqlc`) e commit o resultado em `adapters/postgres/sqlcgen/`.

Checklist do módulo novo:
- [ ] Model em `db/schema/<módulo>/` **e** migration correspondente em `db/migrations/` (os dois em sincronia manual)
- [ ] Códigos de erro novos em `internal/platform/httperr/error.go` (`statusByCode`)
- [ ] Métricas em `internal/platform/observability/metrics.go` (`<modulo>_*`, registradas no `init()`)
- [ ] `<módulo>.New(pool)` chamado em `cmd/api/main.go`; rotas registradas via `httpserver.New(...)`
- [ ] Testes: VO, entity, use-cases (fake in-memory), mapper, repository Postgres (integration), handler HTTP (integration, incluindo o caso de campo desconhecido → 400)

Remoção do `example` (depois que o módulo novo passar nos testes):
- [ ] Apague `internal/modules/example/`
- [ ] `cmd/api/main.go`: remova `example.New(pool)` e o registro das rotas dele
- [ ] `db/schema/example/`, `db/queries/example/`: apague; `sqlc.yaml`: remova a entrada
- [ ] `db/migrations/00001_init.sql`: apague (cria a tabela `items`); gere a inicial do schema novo: `go run ./cmd/migrate up` já aplica migrations existentes — para uma migration nova a partir do schema, escreva o SQL à mão em `db/migrations/NNNNN_init.sql` (goose não gera diff automático; sqlc não lê migrations neste setup, só `db/schema/`)
- [ ] `internal/platform/httperr/error.go`: remova `ITEM_NOT_FOUND`, `INVALID_ITEM_NAME`, `INVALID_ITEM_STATUS`, `INVALID_ITEM_STATUS_TRANSITION`
- [ ] `internal/platform/observability/metrics.go`: remova as métricas `example_*`
- [ ] `CONTEXT.md`: remova as linhas "(exemplo)"
- [ ] `docs/architecture.md` §2: reescreva o parágrafo sobre `internal/modules/example/` descrevendo o módulo real como referência
- [ ] `grep -rn "example\|Item\b\|item_" internal db CONTEXT.md --exclude=architecture-rules.md` não deve achar sobras (`docs/architecture-rules.md` cita o example só como parte do vocabulário, não como código vivo)
- [ ] Referências a `internal/modules/example/` em `CLAUDE.md`, skills e agentes já dizem "ou o módulo real mais completo" — não precisa editar

Validação final (tudo verde):

```bash
go build ./... && go vet ./... && test -z "$(gofmt -l .)"
go test ./...
go run ./scripts/compose -- -f docker-compose.test.yml up -d --wait
go run ./cmd/migrate up
go test -tags=integration ./...
```

Commit: `feat(<modulo>): <resumo>` — e `chore: remove example module` se preferir separar.

Revisão antes do commit:
- Se o Claude Code foi aberto na pasta do projeto (agentes/skills do projeto carregados): rode o agente `arch-reviewer` sobre `internal/modules/<modulo>/` e a skill `observability-enforcer`.
- Senão (ex.: subagente trabalhando em outra pasta): leia `.claude/agents/arch-reviewer.md` e `.claude/skills/observability-enforcer/SKILL.md` do projeto e aplique os checklists à mão sobre o módulo, reportando no formato que eles definem.

Sem remoto, não faça merge em `main` por conta própria: deixe a branch pronta e informe no passo 9 (o fluxo normal é PR).

## Passo 9 — Entregar ao usuário

Informe:
- placeholders usados (incluindo `{{module-path}}`)
- `prompts/00-estrutura-arquitetural.md` seção **Resultado** completada com o que aconteceu nos passos 8–9
- resultado de build / vet / gofmt / unit / integration (número de testes)
- premissas registradas na spec (modo autônomo)
- ajustes que o kit precisou (se houver)
- pendências (Docker ausente, sqlc não instalado, plugins não instalados, remoto do GitHub)
- próximo passo: nova sessão começa com a skill `session-start`; próximos módulos seguem o fluxo de feature (branch → brainstorming → plano → TDD → revisão → PR)

---

## Regras que valem depois do bootstrap

Estão em `CLAUDE.md` e `docs/architecture-rules.md` do projeto. Resumo:
- Branch nova a partir de `origin/main` por tarefa; fim da tarefa = PR.
- Feature: brainstorming → spec → writing-plans → subagent-driven-development / tdd-agent → observability-enforcer → arch-reviewer → verification-before-completion → commit → PR.
- Prompts relevantes em `prompts/`.
