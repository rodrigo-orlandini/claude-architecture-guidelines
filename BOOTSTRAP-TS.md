# BOOTSTRAP-TS — aplicar a estrutura TypeScript em um projeto novo

> Stack TypeScript (Fastify + tsyringe + Prisma + Vitest). Para Go, use `BOOTSTRAP-GO.md`.

Roteiro executável. Escrito para um agente de IA sem contexto prévio, mas qualquer pessoa pode seguir.

- `$KIT` = pasta onde está este arquivo (a pasta `_architecture/` cujo caminho foi passado no prompt).
- `$DEST` = raiz do projeto novo = diretório de trabalho atual.

Entradas (pergunte ao usuário se faltarem; em execução autônoma, derive):
- **Nome legível** → `{{PROJECT_NAME}}` (ex.: `Task Hub`)
- **Slug kebab-case** → `{{project-slug}}` (ex.: `task-hub`; derive do nome)
- **Nome de banco snake_case** → `{{project_db}}` (ex.: `task_hub`; slug com `-` trocado por `_`)
- **Descrição do domínio** (1–3 frases) — usada no passo 7; a primeira frase vira `{{PROJECT_DESCRIPTION}}` (README do projeto)

**Modo autônomo** (ninguém disponível para responder perguntas ou aprovar): em todo ponto que pede resposta/aprovação do usuário, escolha a opção mais simples compatível com a descrição do domínio, registre a decisão numa seção **Premissas** da spec (passo 7) e siga. Nunca invente requisito que a descrição não sugere.

---

## Passo 0 — Pré-requisitos

Confira `$KIT/SETUP.md` §1–2. Mínimo: `node -v` (≥ 20), `npm -v`, `git --version`.

Docker: teste `docker compose version`; se falhar e estiver no Windows, teste `wsl docker compose version`. Qualquer um serve — os scripts do template detectam sozinhos (`scripts/compose.mjs`). Sem nenhum dos dois: avise o usuário e siga; typecheck, lint e unit tests não precisam de Docker.

## Passo 1 — Verificar destino

- Se `$DEST` já tem `package.json`, `src/` ou `.claude/`, **pare e pergunte** antes de sobrescrever. O kit é para projeto novo; em projeto existente, faça merge manual arquivo a arquivo.
- Pasta vazia ou só com `.git` / README: prossiga.

## Passo 2 — Copiar o template

Copie **todo** o conteúdo de `$KIT/template-ts/`, incluindo dotfiles (`.claude/`, `.github/`, `.eslintrc.cjs`, `.env.example`, `.gitignore`):

```bash
cp -r "$KIT/template-ts/." "$DEST/"
```

Não copie `$KIT/reference/` nem os `.md` da raiz do kit.

## Passo 3 — Substituir placeholders

Em todos os arquivos copiados (inclusive `.claude/`, `.github/`, `grafana/`). No Windows rode em Git Bash (o Bash do Claude Code já é Git Bash):

```bash
grep -rl --exclude-dir=node_modules -e '{{PROJECT_NAME}}' -e '{{project-slug}}' -e '{{project_db}}' -e '{{PROJECT_DESCRIPTION}}' . \
  | xargs sed -i -e 's/{{PROJECT_NAME}}/Task Hub/g' -e 's/{{project-slug}}/task-hub/g' -e 's/{{project_db}}/task_hub/g' \
                 -e 's/{{PROJECT_DESCRIPTION}}/API para equipes pequenas gerenciarem tarefas./g'
```

Se a descrição tiver `/` ou `&`, escape-os no `sed` ou edite `README.md` à mão.

`grafana/provisioning/dashboards/app.json` contém `{{route}}` — sintaxe do Grafana, **não** substitua (o comando acima não afeta).

Verifique: `grep -rn '{{PROJECT_NAME}}\|{{project-slug}}\|{{project_db}}\|{{PROJECT_DESCRIPTION}}' .` deve voltar vazio.

## Passo 4 — Ambiente e dependências

```bash
cp .env.example .env
npm install
npx prisma generate
```

## Passo 5 — Validar o template (antes de mudar qualquer coisa)

```bash
npm run typecheck        # código + specs
npm run lint
npm run test:unit
npm run test:integration # precisa de Docker: sobe docker-compose.test.yml, recria schema no banco de teste, roda integration
```

Todos devem passar. Se algo falhar por defeito do kit, corrija no projeto e **informe o usuário** qual arquivo do kit precisou de ajuste.

## Passo 6 — Commit inicial

```bash
git init -b main          # se ainda não for repositório
git add .
git commit -m "chore: bootstrap modular monolith architecture"
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
1. `CONTEXT.md` preenchido: substitua as linhas de exemplo, mantenha as seções. As linhas marcadas "(exemplo)" do módulo example saem no passo 8.
2. Spec em `docs/superpowers/specs/AAAA-MM-DD-dominio-inicial-design.md` com: contexto, módulos, entidades/VOs/invariantes, endpoints, **Premissas** (decisões tomadas sem confirmação), fora de escopo.
3. `prompts/00-estrutura-arquitetural.md`: seção **Prompt** = texto exato que iniciou este bootstrap (substitua o bloco inteiro pelo que o usuário enviou); seção **Resultado** = o que foi gerado até aqui (complete no passo 9).
4. `prompts/01-dominio-inicial.md` no mesmo formato, registrando o brainstorming de domínio.
5. `PROMPTS.md`: adicione a linha 01 no índice.
6. Commit: `docs: domain model and initial spec`.

Referência de projeto real preenchido: `$KIT/reference/casecellshop/` (`CONTEXT.md`, specs em `docs/`, `prompts/`).

## Passo 8 — Primeiro módulo real e remoção do `example`

Implemente **só o primeiro módulo** agora (os demais seguem o fluxo normal de feature, um por branch). Comece numa branch: `git switch -c feat/<modulo>` (ainda não há `origin/main`; parta do `main` local).

Se o módulo central depende de módulos que ainda não existem (ex.: agendamento → paciente), guarde só o id opaco (UUID, sem FK nem validação) e registre como premissa — ver `architecture-rules.md`, "Padrões de domínio".

Espelhe `src/modules/example/`: mesmas pastas, padrões e tipos de teste. Arquivos de referência por necessidade:

| Precisa de | Copie o padrão de |
|---|---|
| VO simples com validação | `entities/value-objects/item-name.ts` |
| Enum / máquina de estados | `entities/value-objects/item-status.ts` + `Item.archive()` |
| Criação (POST, 201, body schema) | `use-cases/create-item/` + `infra/http/item-controller.ts` |
| Leitura por id com 404 | `use-cases/get-item/` + `errors/item-not-found-error.ts` |
| Listagem paginada | `use-cases/list-items/` |
| Persistência | `mappers/item-mapper.ts` + `infra/persistence/prisma-item-repository.ts` (+ integration spec) |
| Teste HTTP (status, schema, 400 para campo extra) | `infra/http/item-controller.integration-spec.ts` (`app.inject`) |
| Id de negócio nos logs | `addToContext` em `use-cases/create-item/create-item.ts` |
| Wiring | `container.ts` |

Checklist do módulo novo:
- [ ] Model no `prisma/schema.prisma` (enum de domínio como `String`)
- [ ] Códigos de erro novos em `src/shared/errors/http-error-mapper.ts`
- [ ] Métricas em `src/shared/observability/metrics.ts` (`<modulo>_*`)
- [ ] `register<Modulo>Module()` chamado em `src/main.ts`; controller registrado em `src/infra/http/server.ts`; tag swagger nova em `server.ts`
- [ ] Specs de VO, entity, use-cases, mapper, presenter; integration spec do repository Prisma e do controller (`app.inject`)

Remoção do `example` (depois que o módulo novo passar nos testes):
- [ ] Apague `src/modules/example/`
- [ ] `src/main.ts`: remova `registerExampleModule`
- [ ] `src/infra/http/server.ts`: remova `ItemController` e a tag swagger `Items`
- [ ] `prisma/schema.prisma`: remova o model `Item`
- [ ] `src/shared/errors/http-error-mapper.ts`: remova `ITEM_NOT_FOUND`, `INVALID_ITEM_NAME`, `INVALID_ITEM_STATUS`, `INVALID_ITEM_STATUS_TRANSITION`
- [ ] `src/shared/observability/metrics.ts`: remova as métricas `example_*`
- [ ] `CONTEXT.md`: remova as linhas "(exemplo)"
- [ ] `docs/architecture.md` §2: reescreva o parágrafo "Enquanto existir, `src/modules/example/`..." descrevendo o módulo real como referência
- [ ] Migrations: apague `prisma/migrations/00000000000000_init/` (cria a tabela `items`) e gere a inicial do schema novo:
  - com Docker: `npm run infra:up && npm run db:migrate -- --name init`
  - sem Docker: `mkdir -p prisma/migrations/00000000000000_init && npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script > prisma/migrations/00000000000000_init/migration.sql`
- [ ] `grep -rn "example\|Item\b\|item-" src prisma CONTEXT.md --exclude=architecture-rules.md` não deve achar sobras (`architecture-rules.md` cita o example só como "enquanto existir")
- [ ] Referências a `src/modules/example/` em `CLAUDE.md`, skills e agentes já dizem "ou o módulo real mais completo" — não precisa editar.

Validação final (tudo verde):

```bash
npm run typecheck && npm run lint && npm run test:unit && npm run test:integration
```

`test:integration` recria o schema do banco de teste a cada execução (`prisma db push --force-reset`), então remover o model `Item` não trava.

Commit: `feat(<modulo>): <resumo>` — e `chore: remove example module` se preferir separar.

Revisão antes do commit:
- Se o Claude Code foi aberto na pasta do projeto (agentes/skills do projeto carregados): rode o agente `arch-reviewer` sobre `src/modules/<modulo>/` e a skill `observability-enforcer`.
- Senão (ex.: subagente trabalhando em outra pasta): leia `.claude/agents/arch-reviewer.md` e `.claude/skills/observability-enforcer/SKILL.md` do projeto e aplique os checklists à mão sobre o módulo, reportando no formato que eles definem.

Sem remoto, não faça merge em `main` por conta própria: deixe a branch pronta e informe no passo 9 (o fluxo normal é PR).

## Passo 9 — Entregar ao usuário

Informe:
- placeholders usados
- `prompts/00-estrutura-arquitetural.md` seção **Resultado** completada com o que aconteceu nos passos 8–9
- resultado de typecheck / lint / unit / integration (número de testes)
- premissas registradas na spec (modo autônomo)
- ajustes que o kit precisou (se houver)
- pendências (Docker ausente, plugins não instalados, remoto do GitHub)
- próximo passo: nova sessão começa com a skill `session-start`; próximos módulos seguem o fluxo de feature (branch → brainstorming → plano → TDD → revisão → PR)

---

## Regras que valem depois do bootstrap

Estão em `CLAUDE.md` e `src/shared/core/architecture-rules.md` do projeto. Resumo:
- Branch nova a partir de `origin/main` por tarefa; fim da tarefa = PR.
- Feature: brainstorming → spec → writing-plans → subagent-driven-development / tdd-agent → observability-enforcer → arch-reviewer → verification-before-completion → commit → PR.
- Prompts relevantes em `prompts/`.
