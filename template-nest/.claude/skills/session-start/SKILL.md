---
name: session-start
description: Session onboarding for {{PROJECT_NAME}}. Loads project context, shows the current state, and directs to the correct skill/agent. Invoke at the start of every new session.
---

# Session Start — {{PROJECT_NAME}}

## What to do

1. Read `CONTEXT.md` — domain glossary, including "Optional Layers Enabled" (whether observability/cache/queue are on for this project)
2. Read `src/shared/core/architecture-rules.md` — architecture rules
3. Read `docs/architecture.md` — structure design
4. List recent specs and plans in `docs/superpowers/specs/` and `docs/superpowers/plans/`
5. List existing modules in `src/modules/` and files present
6. Show the summarized state to the user

## Expected output

```
## {{PROJECT_NAME}} session started

**Modules:**
- <module>: [existing files or "empty"]

**Shared core:** either.ts ✅ | use-case.ts ✅ | domain-error.ts ✅
**Observability:** enabled ✅ | declined (structured logs only) ⚠️

**Which task are we running today?**
```

## Routing by task type

| Declared task | Skill/agent |
|---|---|
| New complex feature / architectural decision | `superpowers:brainstorming` |
| Model an entity, VO, or define invariants | `/domain-modeler` |
| Implement a use-case, entity, repository | `tdd-agent` agent |
| Review a diff before commit | `arch-reviewer` agent |
| Check observability | `/observability-enforcer` |
| Considering a cache, queue, or outbox pattern | Ask the user first — see `CLAUDE.md`, "Scope discipline"; don't reach for `domain-modeler`/`tdd-agent` for that layer until they confirm |
| Before closing any task | `superpowers:verification-before-completion` |
