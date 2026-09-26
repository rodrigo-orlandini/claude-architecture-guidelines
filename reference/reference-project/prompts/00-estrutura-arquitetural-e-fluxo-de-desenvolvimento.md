# 00 Architectural Structure and Development Workflow

## Goal

Define the project's architectural structure, code standards, and internal tooling that guarantee maintainability, readability, and decoupling across development sessions.

## Context

Initial project prompt, prior to any coding. Defines the architecture philosophy and the set of tools (skills, agents) that will be used across all sessions.

## Prompt

```
Before starting to code, we need to keep a good guideline for the code structure, in order to maintain architectural standards for easy maintenance, readability and decoupling. To that end, let's create a set of internal project tools so that in every session we're able to keep this structure without much friction. Describing the structure I expect: this software must be built in a single repository for testing purposes, but in a future migration to microservices we must not have rework, so we're going to work with a modular monolith and Clean Architecture principles, where each module must contain its entities, use-cases, controllers, repositories, interfaces, mappers and presenters, in addition to running tests on the main layers and applying Dependency Injection and Inversion principles and the other SOLID principles. Use superpowers and let's do a brainstorming session to specify these structural details more deeply and clear up all doubts. Let's also think about a complete workflow, where we have the development Skill, review agents to check the standards, etc.
```

## Steering Criteria

Prompt structured to cover three dimensions at once: (1) architectural decision — modular monolith with Clean Architecture prepared for a future migration to microservices; (2) module convention — entities, use-cases, controllers, repositories, interfaces, mappers, presenters; (3) development workflow — skills + review agents for automatic enforcement of the standards. Explicit use of `superpowers:brainstorming` to work out details before any coding.

## Result

Brainstorming carried out with `superpowers:brainstorming`. Design approved in sections. Spec written at `docs/superpowers/specs/2026-09-19-modular-monolith-clean-architecture-design.md`.

Structure implemented:
- Full scaffold under `src/modules/{catalog,checkout,erp-adapter}` with all layers (entities, use-cases, repositories, infra, mappers, presenters, dtos)
- `src/shared/core/either.ts`, `use-case.ts`, `domain-error.ts`, `http-error-mapper.ts`
- Docker Compose dev + test with explicit container names
- Multistage Dockerfile (dev / build / prod)
- `vitest.config.ts` (unit) + `vitest.integration.ts` (integration)
- `CONTEXT.md` — domain glossary
- `src/shared/core/architecture-rules.md` — review checklist

Agents created in `.claude/agents/`:
- `arch-reviewer` — detects dependency violations, missing Either, bypassed DI, kebab-case
- `tdd-agent` — drives red→green→refactor, checks coverage per layer, blocks anti-patterns

Skills created in `.claude/skills/`:
- `session-start` — per-session onboarding, loads context and routes tasks
- `domain-modeler` — extracts VOs, defines invariants, validates naming against CONTEXT.md
- `observability-enforcer` — checklist for logs, metrics, spans, and absence of console.log

Decisions adopted in full. No revision needed.

## Revisions

None.
