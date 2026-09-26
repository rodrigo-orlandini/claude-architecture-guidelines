# 01 — Initial Storefront (GET /products)

## Goal

Implement the `GET /products` endpoint with pagination, without cache and without ERP integration, as the first iteration of the product storefront. Create a seed with ~100 products. Apply TDD with SDD (Subagent-Driven Development).

## Context

First development feature of the reference project. Entry point for the `catalog` module. Cache logic (Redis + TTL + stampede prevention) and real integration with the ERP adapter are deferred to later iterations.

## Prompt

> Let's start developing the project's features. Check the documentation as needed. Save this prompt in the folder under the name "01-vitrine-inicial.md". Start recording only from here onward. Let's start implementing the product storefront, initially in a simple way, without handling cache or any other source of complexity. Think of it as just a simple endpoint reading from a database. The endpoint should be GET /products and should return the list of products from the database with pagination support. Create a .mjs or .sql script to seed the products database initially, considering around 100 different products. Apply the TDD process @.claude\agents\tdd-agent.md during development, and before starting implementation, clear up any doubts you have, creating a solid development structure with SDD (use superpowers)

## Steering Criteria

- "Simple" means no cache, no ERP adapter — direct read from PostgreSQL via Prisma
- TDD mandatory: red → green → refactor per behavior
- SDD: written plan, independent tasks, subagent review after each one
- Full Clean Architecture: entity, VO, use-case, repository interface, Prisma impl, controller, presenter, DI container
- Observability: correlationId + pino logger + span included even in this simple iteration (project requirement)
- Offset-based pagination (page + limit) with a meta envelope

## Result

_To be filled in after implementation_

## Revisions

_To be filled in if there are iterations_
