---
name: domain-modeler
description: Domain modeling for {{PROJECT_NAME}}. Use before creating any entity or value object. Extracts VOs, defines invariants, and validates naming against CONTEXT.md.
---

# Domain Modeler — {{PROJECT_NAME}}

## Process

### 1. Context
Read `CONTEXT.md` and the module in question (`src/modules/<module>/entities/`).

### 2. Identify Value Object candidates

For each field of the proposed entity, ask:
- Does it have its own validation? (format, range, business rule)
- Does it have its own behavior? (methods, transformations)
- Is it compared by value, not by identity?

If yes to any of these → it's a VO.

Extraction examples:
```
Price       → cannot be negative, monetary rounding
SKU / Code  → validated format (e.g. regex)
Quantity    → positive integer, no zero
Status      → enum with valid transitions (e.g. PENDING → PROCESSING → CONFIRMED | FAILED)
Email       → validated format, normalized to lowercase
```

VO follows the pattern: private constructor + `static create(raw): Either<InvalidXError, X>`.
Reference: `entities/value-objects/` of the reference module (`src/modules/example/` while it exists: `item-name.ts` for a simple VO, `item-status.ts` for an enum with transitions).

### 3. Define entity invariants

For each identified business rule, decide:
- It belongs to the **entity** (structural invariant — e.g. "price cannot be negative")
- It belongs to the **use-case** (application rule — e.g. "insufficient stock blocks checkout")

Never put an application rule inside the entity.

### 4. Validate naming

- Is the entity name aligned with `CONTEXT.md`? If not, propose a glossary update.
- VOs in `entities/value-objects/` with an explicit name (e.g. `product-price.ts`, not `price.ts`).

### 5. Check scope before reaching for infra

If this entity/use-case seems to need a cache, a queue, or an outbox pattern to work — stop and ask the user first (see `CLAUDE.md`, "Scope discipline"). Don't default to that infra just because the reference project used it for a similar-looking feature.

### 6. Output

Before any code, present:

```
Entity: <Name>
Fields:
  - id: string (UUID)
  - <field>: <Type> (VO | primitive)

Value Objects to create:
  - <Vo>: <rule>

Entity invariants:
  - ...

Use-case invariants (NOT in the entity):
  - ...
```

Wait for approval before generating code. After approval, update `CONTEXT.md`.
