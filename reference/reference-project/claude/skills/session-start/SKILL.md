---
name: session-start
description: Reference project session onboarding. Loads project context, shows the current state, and directs to the correct skill/agent. Invoke at the start of every new session.
---

# Session Start — Reference Project

## What to do

1. Read `CONTEXT.md` — domain glossary
2. Read `src/shared/core/architecture-rules.md` — architecture rules
3. Read `docs/superpowers/specs/2026-09-19-modular-monolith-clean-architecture-design.md` — approved design
4. List existing modules in `src/modules/` and the files present
5. Show a summarized state to the user

## Expected output

```
## Reference Project session started

**Modules:**
- catalog: [existing files or "empty"]
- checkout: [existing files or "empty"]
- erp-adapter: [existing files or "empty"]

**Shared core:** either.ts ✅ | use-case.ts ✅ | domain-error.ts ✅

**Which task are we tackling today?**
```

## Routing by task type

| Declared task | Skill/agent |
|---|---|
| Complex new feature / architectural decision | `/brainstorming` |
| Model entity, VO, or define invariants | `/domain-modeler` |
| Implement use-case, entity, repository | `tdd-agent` agent |
| Review diff before commit | `arch-reviewer` agent |
| Check observability | `/observability-enforcer` |
| Before closing any task | `superpowers:verification-before-completion` |
