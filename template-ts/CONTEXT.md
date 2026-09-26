# {{PROJECT_NAME}} Domain

Living glossary. Updated as domain modeling progresses.
Referenced by the `domain-modeler`, `tdd`, `session-start`, and `improve-codebase-architecture` skills.

> Fill in during initial brainstorming. Use these exact names in the code.
> Filled-in real example: `_architecture/reference/reference-project/CONTEXT.md`.

## Entities and Concepts

- **Item** — example entity from the `example` module (remove along with the module)
- **<Entity>** — <one-line definition>

## Modules

- **example** — reference module with all layers; delete once there's a real module
- **<module>** — <responsibility>; source of truth: <where>

## Main Flows

- `POST /items` — creates an ACTIVE item; 422 `INVALID_ITEM_NAME` if the name is invalid (example)
- `GET /items` — paginated list of items (example)
- `GET /items/:id` — item by id; 404 with `ITEM_NOT_FOUND` (example)
- `<METHOD> /<route>` — <what it does>

## Domain Invariants

- Item requires a non-empty name with a maximum of 120 characters (example)
- Item is born ACTIVE; only transitions ACTIVE → ARCHIVED; ARCHIVED is terminal (example)
- <rule that can never be violated>
