# SETUP — o que instalar e configurar além dos arquivos copiados

Os arquivos de `template-ts/` ou `template-go/` não bastam sozinhos: parte do fluxo depende de ferramentas da máquina e de plugins do Claude Code. Faça isto **uma vez por máquina** (itens 1–3) e **uma vez por projeto** (itens 4–6). Itens marcados **[TS]** ou **[Go]** valem só para a stack correspondente; o resto vale para as duas.

---

## 1. Ferramentas de sistema

| Ferramenta | Versão | Para quê | Verificar |
|---|---|---|---|
| Node.js **[TS]** | 22 LTS (20+ funciona) | runtime, npm, vitest | `node -v` |
| Go **[Go]** | 1.26+ | toolchain, testes, migrations | `go version` |
| sqlc **[Go]** | recente | gerar código de acesso a dados a partir de SQL | `sqlc version` |
| Git | qualquer recente | branches por tarefa | `git --version` |
| Docker Engine + Compose v2 | recente | Postgres (e Redis, no kit TS) de dev e de teste, stack de observabilidade | `docker compose version` |
| GitHub CLI (`gh`) | recente | abrir PR ao fim de cada tarefa | `gh --version` |
| Claude Code | recente | skills, agentes, plugins | `claude --version` |

Passo a passo:

1. **[TS]** Instale Node 22: https://nodejs.org (ou `nvm install 22`).
   **[Go]** Instale Go 1.26+: https://go.dev/dl/. Instale o sqlc: `go install github.com/sqlc-dev/sqlc/cmd/sqlc@latest` (só é preciso para regenerar código depois de mudar uma query/schema — não é necessário para rodar ou testar o projeto).
   **Windows, cuidado com PATH duplicado:** se você tiver mais de uma instalação de Go (comum: uma via instalador oficial de 64 bits e outra via `go install`/Scoop/Chocolatey de 32 bits), confira qual `go.exe` vem primeiro no PATH (`where go` no PowerShell/cmd, ou `which -a go` no Git Bash) e garanta que seja a versão **amd64**. Uma toolchain 32 bits (`386`) compila normalmente, mas ferramentas que embutem um parser WASM (como o `sqlc`) podem falhar com um panic de alocador de memória (`allocator_windows: failed to reserve memory`) quando rodam como binário 32 bits — reinstale a partir do `go.exe` amd64 (`go env GOARCH` deve dizer `amd64`) para corrigir.
2. Instale Docker:
   - **Windows sem Docker Desktop**: instale WSL2 + Ubuntu (`wsl --install -d Ubuntu`), dentro do Ubuntu instale Docker Engine (https://docs.docker.com/engine/install/ubuntu/) e o plugin compose (`sudo apt install docker-compose-plugin`). As portas dos containers ficam acessíveis em `localhost` no Windows, então a toolchain (Node ou Go) continua rodando no Windows.
     Nada a editar no projeto: os comandos de compose passam por um wrapper portátil que detecta sozinho se `docker compose` funciona e, se não, usa `wsl docker compose` — **[TS]** `node scripts/compose.mjs <args>`, **[Go]** `go run ./scripts/compose -- <args>`. Para comandos manuais, prefixe com `wsl` diretamente: `wsl docker compose <args>`.
     Se o `sqlc` (Go) também falhar por ser um binário 32 bits problemático mesmo depois de corrigir o PATH, baixe o release `linux_amd64` do sqlc e rode via `wsl /caminho/sqlc generate` — o binário linux funciona normalmente dentro do WSL.
   - **Windows com Docker Desktop / macOS / Linux**: instale normalmente; nada a ajustar.
3. Instale e autentique o GitHub CLI: `gh auth login`.
4. Instale Claude Code: https://docs.claude.com/claude-code.

---

## 2. Plugins do Claude Code (obrigatórios)

O fluxo usa skills que **não** estão em `template-ts/.claude/` / `template-go/.claude/` porque vêm de plugins:

| Plugin | Fornece | Usado em |
|---|---|---|
| `superpowers@claude-plugins-official` | `brainstorming`, `writing-plans`, `subagent-driven-development`, `executing-plans`, `test-driven-development`, `systematic-debugging`, `requesting-code-review`, `verification-before-completion`, `finishing-a-development-branch`, `using-git-worktrees` | todo o ciclo de feature |
| `clean-architecture@clean-architecture-skills` (repo `nathankim0/clean-architecture-skills`) **[TS]** | skill `clean-architecture` (revisão por princípios de Clean Architecture/SOLID) | revisões de design |

Instalação (dentro do Claude Code, em qualquer pasta):

```
/plugin marketplace add anthropics/claude-plugins-official
/plugin install superpowers@claude-plugins-official

/plugin marketplace add nathankim0/clean-architecture-skills
/plugin install clean-architecture@clean-architecture-skills
```

`.claude/settings.json` de cada template já declara o marketplace extra e habilita os plugins no escopo do projeto — ao abrir o projeto, o Claude Code oferece instalar o que faltar. Confirme com `/plugin` que aparecem habilitados.

Verificação: em uma sessão nova no projeto, a skill `superpowers:brainstorming` (e, no kit TS, `clean-architecture:clean-architecture`) deve aparecer na lista de skills disponíveis.

---

## 3. Plugins/ferramentas opcionais (usados no projeto original, não necessários)

| Item | O que é | Como instalar |
|---|---|---|
| `caveman` | respostas comprimidas (economia de tokens) | `/plugin marketplace add JuliusBrussee/caveman` → `/plugin install caveman@caveman` |
| `rtk` | proxy que condensa saída de comandos | bloco "Command output" no `CLAUDE.md` só faz sentido se `rtk` estiver instalado; senão, não copie |
| `graphify` | grafo de conhecimento do código (`/graphify`) | skill global em `~/.claude/skills/graphify/`; `graphify-out/` é gerado, não versione se não usar |

**[TS] Skill `improve-codebase-architecture` (opcional, incompleta):** `template-ts/.claude/skills/improve-codebase-architecture/SKILL.md` foi copiada como estava no projeto original. Invocada só manualmente (`disable-model-invocation: true`), referencia skills que não existem no kit (`codebase-design`, `grilling`, `domain-modeling`) e um `HTML-REPORT.md` ausente. Funciona como roteiro mesmo assim; para usar completa, instale as skills correspondentes (coleção de Matt Pocock, `github.com/mattpocock/skills`). Se não for usar, apague a pasta.

---

## 4. Por projeto: variáveis de ambiente

```bash
cp .env.example .env
```

- **[TS]** Rodando app **dentro** do compose: hosts internos já vêm configurados no `docker-compose.yml`. Rodando fora (`npm run dev:local`): use os hosts `localhost` do `.env.example`.
- **[Go]** `.env.example` já usa `localhost` (para `go run ./cmd/api` no host); o `docker-compose.yml` sobrescreve `DATABASE_URL` para o serviço `app` via `environment:`.
- `OTEL_EXPORTER_OTLP_ENDPOINT` vazio = spans no stdout; com a stack de observabilidade: `http://localhost:4318`.

---

## 5. Por projeto: GitHub

1. Crie o repositório e faça o push inicial em `main`:
   ```bash
   git init -b main && git add . && git commit -m "chore: bootstrap architecture"
   gh repo create <nome> --private --source . --push
   ```
2. CI (`.github/workflows/ci.yml`) roda sozinho em push/PR para `main`. Não precisa de secrets: Postgres (e Redis, no kit TS) são `services:` do runner.
3. Recomendado: proteja `main` exigindo os checks `Build`, `Unit Tests`, `Integration Tests`, `Coverage` (Settings → Branches).

---

## 6. Por projeto: memória do Claude Code

Preferências que o projeto original (TS) tinha em memória local (não versionada) e que agora estão escritas nas regras:

- **[TS]** Arquivo de interface sem prefixo `i-` (`item-repository.ts`), interface com prefixo `I` (`IItemRepository`) → em `architecture-rules.md`. **[Go]** o equivalente é justamente o oposto: sem prefixo `I` em nenhum lugar (`ItemRepository`) — Go não usa Hungarian notation; já documentado em `docs/architecture-rules.md` do kit Go.
- Seed/dados de teste entram pela fonte de verdade (ex.: sistema externo), nunca direto no banco derivado, para validar o fluxo real → registre regra equivalente no `CLAUDE.md` se o domínio novo tiver sincronização com sistema externo.

---

## Checklist final

- [ ] **[TS]** `node -v` ≥ 20 · **[Go]** `go version` ≥ 1.26 e `go env GOARCH` = `amd64`
- [ ] `docker compose version` (ou `wsl docker compose version`) ok
- [ ] `gh auth status` ok — só necessário quando for criar o repositório remoto (§5)
- [ ] `/plugin` mostra `superpowers` (e, no kit TS, `clean-architecture`) habilitados
- [ ] `.env` criado
- [ ] **[TS]** `npm run typecheck && npm run test:unit` verdes · **[Go]** `go build ./... && go vet ./... && go test ./...` verdes
- [ ] **[TS]** `npm run test:integration` verde · **[Go]** `go test -tags=integration ./...` verde (banco de teste de pé e migrado)
- [ ] Repositório no GitHub com CI rodando
