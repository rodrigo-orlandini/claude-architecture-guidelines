# SETUP — what to install and configure beyond the copied files

`template-ts/` or `template-go/`'s files aren't enough on their own: part of the workflow depends on machine tooling and Claude Code plugins. Do this **once per machine** (items 1–3) and **once per project** (items 4–6). Items marked **[TS]** or **[Go]** apply only to that stack; the rest applies to both.

---

## 1. System tools

| Tool | Version | For | Check |
|---|---|---|---|
| Node.js **[TS]** | 22 LTS (20+ works) | runtime, npm, vitest | `node -v` |
| Go **[Go]** | 1.26+ | toolchain, tests, migrations | `go version` |
| sqlc **[Go]** | latest | generate data-access code from SQL | `sqlc version` |
| Git | any recent | one branch per task | `git --version` |
| Docker Engine + Compose v2 | recent | Postgres (and Redis, in the TS kit) for dev and test, observability stack | `docker compose version` |
| GitHub CLI (`gh`) | recent | open a PR at the end of each task | `gh --version` |
| Claude Code | recent | skills, agents, plugins | `claude --version` |

Step by step:

1. **[TS]** Install Node 22: https://nodejs.org (or `nvm install 22`).
   **[Go]** Install Go 1.26+: https://go.dev/dl/. Install sqlc: `go install github.com/sqlc-dev/sqlc/cmd/sqlc@latest` (only needed to regenerate code after changing a query/schema — not required to run or test the project).
   **Windows, watch out for a duplicate PATH:** if you have more than one Go install (common: one from the official 64-bit installer and another via `go install`/Scoop/Chocolatey at 32-bit), check which `go.exe` comes first on PATH (`where go` in PowerShell/cmd, or `which -a go` in Git Bash) and make sure it's the **amd64** build. A 32-bit (`386`) toolchain compiles fine, but tools that embed a WASM parser (like `sqlc`) can fail with a memory-allocator panic (`allocator_windows: failed to reserve memory`) when running as a 32-bit binary — reinstall from the amd64 `go.exe` (`go env GOARCH` should say `amd64`) to fix it.
2. Install Docker:
   - **Windows without Docker Desktop**: install WSL2 + Ubuntu (`wsl --install -d Ubuntu`), then inside Ubuntu install Docker Engine (https://docs.docker.com/engine/install/ubuntu/) and the compose plugin (`sudo apt install docker-compose-plugin`). Container ports stay reachable at `localhost` on Windows, so the toolchain (Node or Go) keeps running on Windows.
     Nothing to edit in the project: compose commands go through a portable wrapper that detects on its own whether `docker compose` works and, if not, falls back to `wsl docker compose` — **[TS]** `node scripts/compose.mjs <args>`, **[Go]** `go run ./scripts/compose -- <args>`. For manual commands, prefix with `wsl` directly: `wsl docker compose <args>`.
     If `sqlc` (Go) also fails as a problematic 32-bit binary even after fixing PATH, download the `linux_amd64` sqlc release and run it via `wsl /path/to/sqlc generate` — the Linux binary works fine inside WSL.
   - **Windows with Docker Desktop / macOS / Linux**: install normally; nothing to adjust.
3. Install and authenticate the GitHub CLI: `gh auth login`.
4. Install Claude Code: https://docs.claude.com/claude-code.

---

## 2. Claude Code plugins (required)

The workflow uses skills that **aren't** in `template-ts/.claude/` / `template-go/.claude/` because they come from plugins:

| Plugin | Provides | Used in |
|---|---|---|
| `superpowers@claude-plugins-official` | `brainstorming`, `writing-plans`, `subagent-driven-development`, `executing-plans`, `test-driven-development`, `systematic-debugging`, `requesting-code-review`, `verification-before-completion`, `finishing-a-development-branch`, `using-git-worktrees` | the whole feature cycle |
| `clean-architecture@clean-architecture-skills` (repo `nathankim0/clean-architecture-skills`) **[TS]** | the `clean-architecture` skill (review against Clean Architecture/SOLID principles) | design reviews |

Installation (inside Claude Code, from any folder):

```
/plugin marketplace add anthropics/claude-plugins-official
/plugin install superpowers@claude-plugins-official

/plugin marketplace add nathankim0/clean-architecture-skills
/plugin install clean-architecture@clean-architecture-skills
```

Each template's `.claude/settings.json` already declares the extra marketplace and enables the plugins at the project scope — when Claude Code opens the project, it offers to install whatever's missing. Confirm with `/plugin` that they show up as enabled.

Verification: in a new session on the project, the `superpowers:brainstorming` skill (and, in the TS kit, `clean-architecture:clean-architecture`) should show up in the list of available skills.

---

## 3. Optional plugins/tools (used in the original project, not required)

| Item | What it is | How to install |
|---|---|---|
| `caveman` | compressed responses (token savings) | `/plugin marketplace add JuliusBrussee/caveman` → `/plugin install caveman@caveman` |
| `rtk` | proxy that condenses command output | the "Command output" block in `CLAUDE.md` only makes sense if `rtk` is installed; otherwise, don't copy it |
| `graphify` | code knowledge graph (`/graphify`) | global skill at `~/.claude/skills/graphify/`; `graphify-out/` is generated — don't version it if you're not using it |

**[TS] `improve-codebase-architecture` skill (optional, incomplete):** `template-ts/.claude/skills/improve-codebase-architecture/SKILL.md` was copied as-is from the original project. It's invoked manually only (`disable-model-invocation: true`), and references skills that don't exist in this kit (`codebase-design`, `grilling`, `domain-modeling`) plus a missing `HTML-REPORT.md`. It still works as a rough playbook regardless; to use it in full, install the matching skills (Matt Pocock's skill collection, `github.com/mattpocock/skills`). If you won't use it, delete the folder.

---

## 4. Per project: environment variables

```bash
cp .env.example .env
```

- **[TS]** Running the app **inside** compose: the internal hostnames are already set up in `docker-compose.yml`. Running it outside (`npm run dev:local`): use the `localhost` hosts from `.env.example`.
- **[Go]** `.env.example` already uses `localhost` (for `go run ./cmd/api` on the host); `docker-compose.yml` overrides `DATABASE_URL` for the `app` service via `environment:`.
- `OTEL_EXPORTER_OTLP_ENDPOINT` empty = spans go to stdout; with the observability stack up: `http://localhost:4318`.

---

## 5. Per project: GitHub

1. Create the repository and push the initial commit to `main`:
   ```bash
   git init -b main && git add . && git commit -m "chore: bootstrap architecture"
   gh repo create <name> --private --source . --push
   ```
2. CI (`.github/workflows/ci.yml`) runs on its own on push/PR to `main`. No secrets needed: Postgres (and Redis, in the TS kit) are runner `services:`.
3. Recommended: protect `main` by requiring the `Build`, `Unit Tests`, `Integration Tests`, `Coverage` checks (Settings → Branches).

---

## 6. Per project: Claude Code memory

Preferences the original project (TS) had in local, unversioned memory, now written into the rules instead:

- **[TS]** Repository interface file with no `i-` prefix (`item-repository.ts`), interface itself keeps the `I` prefix (`IItemRepository`) → in `architecture-rules.md`. **[Go]** the equivalent is the exact opposite: no `I` prefix anywhere (`ItemRepository`) — Go doesn't use Hungarian notation; already documented in the Go kit's `docs/architecture-rules.md`.
- Seed/test data enters through the source of truth (e.g. an external system), never straight into the derived database, so it exercises the real flow → record an equivalent rule in `CLAUDE.md` if the new domain syncs with an external system.

---

## Final checklist

- [ ] **[TS]** `node -v` ≥ 20 · **[Go]** `go version` ≥ 1.26 and `go env GOARCH` = `amd64`
- [ ] `docker compose version` (or `wsl docker compose version`) ok
- [ ] `gh auth status` ok — only needed once you create the remote repository (§5)
- [ ] `/plugin` shows `superpowers` (and, in the TS kit, `clean-architecture`) enabled
- [ ] `.env` created
- [ ] **[TS]** `npm run typecheck && npm run test:unit` green · **[Go]** `go build ./... && go vet ./... && go test ./...` green
- [ ] **[TS]** `npm run test:integration` green · **[Go]** `go test -tags=integration ./...` green (test database up and migrated)
- [ ] Repository on GitHub with CI running
