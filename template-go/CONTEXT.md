# {{PROJECT_NAME}} Domain

Living glossary. Updated as domain modeling progresses.
Referenced by the `domain-modeler`, `tdd`, `session-start` skills and by the `arch-reviewer`/`tdd-agent` agents.

> Fill in during initial brainstorming. Use exactly these names in the code.
> Real filled-in example (TS kit, same process): `_architecture/reference/reference-project/CONTEXT.md`.

## Entities and Concepts

- **Item** — example entity of the `example` module (remove along with the module)
- **<Entity>** — <one-line definition>

## Modules

- **example** — reference module with all layers; delete once a real module exists
- **<module>** — <responsibility>; source of truth: <where>

## Main Flows

- `POST /items` — creates an ACTIVE item; 422 `INVALID_ITEM_NAME` if the name is invalid (example)
- `GET /items` — paginated list of items (example)
- `GET /items/{itemId}` — item by id; 404 `ITEM_NOT_FOUND` (example)
- `<METHOD> /<route>` — <what it does>

## Domain Invariants

- Item requires a non-empty name with at most 120 characters (example)
- Item is born ACTIVE; only transitions ACTIVE → ARCHIVED; ARCHIVED is terminal (example)
- <rule that can never be violated>

## Optional Layers Enabled

Track here which opt-in layers (see `CLAUDE.md`, "Scope discipline") this project actually turned on, so it's not buried in chat history:

- Observability (tracing/metrics/Grafana): <enabled at bootstrap | declined at bootstrap | enabled later on <date>, for <reason>>
- Cache: <not in use | added on <date> for <module>, because <reason>>
- Queue / async processing: <not in use | added on <date> for <module>, because <reason>>
</content>
