# BOOTSTRAP — gather inputs, then choose the stack

This file is the entry point. It does two things, in order: (1) make sure the required inputs are known, asking the user for whichever is missing — never guessing them, even in unattended/autonomous execution; (2) route to the stack-specific playbook, which only scaffolds and validates the template. **No stack playbook implements any feature or models the domain on its own** — that starts later, from the user's own prompts (see "After the scaffold" below).

## Step A — Required inputs

Five things must be known before touching any file. If the user's initial message already gave one, don't ask it again; ask only for what's missing, in one question per item (or grouped, if your tool supports asking several at once).

1. **Language** — e.g. TypeScript (Node.js), Go. If this kit doesn't have a `template-<stack>/` for the requested language yet, say so and stop; don't improvise a template ad hoc (see README.md, "Adding a new stack" — that's a separate, deliberate task, not something to shortcut here).
2. **Framework / tooling** — only ask this when the chosen language has more than one option in this kit. Today:
   - TypeScript → **Fastify** (`template-ts/`) or **NestJS** (`template-nest/`)
   - Go → only `template-go/` (net/http), nothing to ask
   Check this file's routing table below for the current set of languages/frameworks — it's updated whenever a new template is added.
3. **Project name** — the readable name (`{{PROJECT_NAME}}`) the rest of the placeholders derive from.
4. **Scope** — one to three sentences on what the system does. This is NOT a full domain model; it's just enough to substitute `{{PROJECT_DESCRIPTION}}` and to hand to `superpowers:brainstorming` later. Don't press for more detail than that here — deeper modeling happens after the scaffold, driven by the user's own prompts.
5. **Observability** — full stack (structured logs + correlationId + OpenTelemetry tracing + Prometheus metrics + a Grafana/Loki/Tempo dashboard) from day one, or just structured logs in the terminal for now, with tracing/metrics/dashboard added later if needed? Structured logging + correlationId are never optional — cheap, and useful at any size — this question is only about the heavier telemetry layer. Each stack playbook has a step that strips the heavier layer back out if the answer is "logs only."

Do not derive, assume, or pick a "sensible default" for any of these five — ask. This applies even when running unattended (a subagent, a scripted session): stop and ask rather than guess. Guessing wrong here means the whole scaffold is wrong. This is the first instance of a broader rule that keeps applying after the bootstrap too: **before adding any layer aimed at "large project" scale — cache, queue, outbox pattern, full telemetry, or similar — ask, don't assume.** See "Scope discipline" in each template's `CLAUDE.md`.

## Step B — Route to the stack playbook

| Language | Framework | Playbook |
|---|---|---|
| TypeScript (Node.js) | Fastify | [`BOOTSTRAP-TS.md`](./BOOTSTRAP-TS.md) |
| TypeScript (Node.js) | NestJS | [`BOOTSTRAP-NEST.md`](./BOOTSTRAP-NEST.md) |
| Go | net/http (only option) | [`BOOTSTRAP-GO.md`](./BOOTSTRAP-GO.md) |

Pass the project name, scope, and observability answer you gathered in Step A into the chosen playbook — it does not ask for them again.

## After the scaffold

Every stack playbook stops at the same point: scaffold copied, placeholders substituted, dependencies installed, template validated (build/tests green), initial commit made. **Then it stops. It does not model the domain and does not implement any module.**

Once a playbook hands back to you:
- If the user's next message already describes a feature or module, build it the normal way: `session-start` → (`superpowers:brainstorming` if it's a non-trivial decision) → `writing-plans` → `tdd-agent` → `observability-enforcer` → `arch-reviewer` → PR. Same flow as any other task in this kit, on any other day.
- If the user hasn't said what to build yet, don't build anything. Ask them, or — if the `superpowers` plugin is installed (check whether `superpowers:brainstorming` shows up among your available skills) — offer to run `superpowers:brainstorming` to plan the domain together before writing any code.
- Either way, work **incrementally**: one module or one slice of behavior per cycle, not the whole domain in one shot. The scaffold's own `example` module stays in place until the first real module is ready to replace it (see each playbook's "Building the first module" reference section for that swap).
- The same "ask before adding" rule from Step A keeps applying: a cache, a queue, an outbox pattern, or turning telemetry on later are all things to ask about when they come up, not defaults to reach for because the feature "seems like" it'll need them eventually.

## Shared reference

- `SETUP.md` — machine/Claude Code prerequisites and setup (sections marked per stack where they diverge)
- Same architecture principles everywhere (modular monolith, dependency rule, TDD, observability from day one) and the same session flow (`session-start` → `brainstorming` → `writing-plans` → `tdd-agent` → `observability-enforcer` → `arch-reviewer` → PR) — only each stack/framework's idiomatic mechanism changes

Adding a new stack or a new framework option for an existing language follows the same shape: a new `template-<name>/` folder + `BOOTSTRAP-<NAME>.md` playbook that ends the same way (scaffold, validate, stop — no auto-implementation), plus a new row in the routing table above.
