---
name: session-start
description: Session onboarding for {{PROJECT_NAME}}. Loads project context, shows the current state, and directs to the correct skill/agent. Invoke at the start of every new session.
---

# Session Start — {{PROJECT_NAME}}

## What to do

1. Read `CONTEXT.md` — domain glossary
2. Read `docs/architecture-rules.md` — architecture rules
3. Read `docs/architecture.md` — structure design
4. List recent specs and plans in `docs/superpowers/specs/` and `docs/superpowers/plans/`
5. List existing modules in `internal/modules/` and their use-cases (`go list ./internal/modules/...`)
6. Run `git status` and `git log --oneline -5`
7. Show the summarized state to the user

## Expected output

```
## {{PROJECT_NAME}} session started

**Branch:** <current branch>
**Modules:**
- <module>: [existing use-cases or "empty"]

**Shared platform:** httperr ✅ | observability (logger/metrics/tracer) ✅ | db (pool + migrate) ✅

**Last spec/plan:** <file>

**Which task are we running today?**
```

## Routing by task type

| Declared task | Skill/agent |
|---|---|
| Complex new feature / architectural decision | `superpowers:brainstorming` → spec → `superpowers:writing-plans` |
| Execute an approved plan | `superpowers:subagent-driven-development` |
| Model an entity, VO, or define invariants | `/domain-modeler` |
| Implement use-case, entity, repository | `tdd-agent` agent |
| Bug / test failure | `superpowers:systematic-debugging` |
| Check observability | `/observability-enforcer` |
| Review diff before commit | `arch-reviewer` agent |
| Before closing any task | `superpowers:verification-before-completion` |
| Finish branch / open PR | `superpowers:finishing-a-development-branch` |

Reminder: every new task starts on a new branch from `origin/main` and ends in a PR.
</content>
