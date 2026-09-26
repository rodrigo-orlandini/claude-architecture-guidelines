# 00 Architectural Structure

## Objective

Apply the standard Go structure (modular monolith + Clean Architecture + Claude Code skills/agents) to {{PROJECT_NAME}}.

## Context

Initial project prompt, prior to any feature. Structure copied from `_architecture/template-go/` (Go variant of the kit originated in the reference project, in TypeScript).

## Prompt

```
Read <path>/_architecture/README.md and follow BOOTSTRAP-GO.md to apply the structure to this project.
Project name: {{PROJECT_NAME}}. Domain: <short description>.
```

## Direction Criteria

Structure already validated in another project (TS) and ported to Go preserving the principles (modular monolith, dependency rule, TDD, observability) with the language's idiomatic mechanism (interfaces without an `I` prefix, `(T, error)` instead of `Either`, manual wiring instead of a DI container, native `net/http` instead of a framework). The prompt only points to the kit and gives the name and domain; architecture decisions are not re-discussed.

## Result

<fill in: what was generated, what was adjusted>

## Revisions

None.
</content>
