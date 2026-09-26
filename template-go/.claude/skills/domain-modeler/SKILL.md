---
name: domain-modeler
description: Domain modeling for {{PROJECT_NAME}}. Use before creating any entity or value object. Extracts VOs, defines invariants, and validates naming against CONTEXT.md.
---

# Domain Modeler — {{PROJECT_NAME}}

## Process

### 1. Context
Read `CONTEXT.md` and the module in question (`internal/modules/<module>/domain/`).

### 2. Identify Value Object candidates

For each field of the proposed entity, ask:
- Does it have its own validation? (format, range, business rule)
- Does it have its own behavior? (methods, transformations)
- Is it compared by value, not by identity?

If yes to any of these → it's a VO.

Extraction examples:
```
Price       → cannot be negative, monetary rounding
Code        → validated format (e.g. regex)
Quantity    → positive integer, no zero
Status      → enum with valid transitions (e.g. PENDING → PROCESSING → CONFIRMED | FAILED)
Email       → validated format, normalized to lowercase
```

In Go, a VO is a struct with an unexported field + constructor `New<Vo>(raw) (<Vo>, error)` — the unexported field replaces the "private constructor" of the TS kit, since only the package itself can build the value directly. An enum is a named string type with consts and (when there's a state machine) a `TransitionTo` method.

Reference: `internal/modules/example/domain/` while it exists (`item_name.go` for a simple VO, `item_status.go` for an enum with transitions).

### 3. Define entity invariants

For each identified business rule, decide:
- It belongs to the **entity** (structural invariant — e.g. "price cannot be negative")
- It belongs to the **use-case** (application rule — e.g. "insufficient stock blocks checkout")

Never put an application rule inside the entity.

### 4. Validate naming

- Is the entity name aligned with `CONTEXT.md`? If not, propose a glossary update
- No `I` prefix on interfaces (Go doesn't use Hungarian notation) — the port is just `ItemRepository`, defined in the `usecase` package that consumes it
- Packages in a single lowercase word (`domain`, `usecase`, not `use_cases` nor `useCases`); files in `snake_case.go`

### 5. Output

Before any code, present:

```
Entity: <Name>
Fields:
  - ID: string (UUID)
  - <field>: <Type> (VO | primitive)

Value Objects to create:
  - <Vo>: <rule>

Entity invariants:
  - ...

Use-case invariants (NOT in the entity):
  - ...
```

Wait for approval before generating code. After approval, update `CONTEXT.md`.
</content>
