# BOOTSTRAP — choose the stack

This kit has one variant per stack. This file only decides which one to follow; the executable playbook lives in the stack-specific file.

- **TypeScript** (Fastify + tsyringe + Prisma + Vitest): follow [`BOOTSTRAP-TS.md`](./BOOTSTRAP-TS.md)
- **Go** (native net/http + sqlc + pgx): follow [`BOOTSTRAP-GO.md`](./BOOTSTRAP-GO.md)

If the user already stated the stack (in the prompt, or because the destination project already has a `go.mod`/`package.json`), go straight to the matching file without asking. If they didn't say and there's no way to infer it, ask before proceeding — the two variants have completely different scaffolds and validation commands, so picking the wrong one means redoing the work.

Both variants share:
- `SETUP.md` — machine/Claude Code prerequisites and setup (sections marked **[TS]** or **[Go]** where they diverge)
- The same architecture principles (modular monolith, dependency rule, TDD, observability from day one) and the same session flow (`session-start` → `brainstorming` → `writing-plans` → `tdd-agent` → `observability-enforcer` → `arch-reviewer` → PR) — only each layer's idiomatic mechanism changes

A new stack (Python, or another) is a new `template-<stack>/` folder + `BOOTSTRAP-<STACK>.md`, following the same shape: same `docs/architecture.md`/`docs/architecture-rules.md` principles, the new language's own idiomatic mechanism.
