---
name: domain-modeler
description: Reference project domain modeling. Use before creating any entity or value-object. Extracts VOs, defines invariants, and validates naming against CONTEXT.md.
---

# Domain Modeler — Reference Project

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
ProductPrice  → cannot be negative, monetary rounding
SKU           → validated format (e.g. regex)
Quantity      → positive integer, no zero
OrderStatus   → enum with valid transitions (PENDING → PROCESSING → CONFIRMED | FAILED)
```

### 3. Define the entity's invariants

For each business rule identified, decide:
- It belongs to the **entity** (structural invariant — e.g. "price cannot be negative")
- It belongs to the **use-case** (application rule — e.g. "insufficient stock blocks checkout")

Never put an application rule inside the entity.

### 4. Validate naming

- Is the entity name aligned with `CONTEXT.md`? If not, propose a glossary update
- Are VOs in `entities/value-objects/` with an explicit suffix in the name? (e.g.: `product-price.ts`, not `price.ts`)

### 5. Output

Before any code, present:

```
Entity: Product
Fields:
  - id: string (UUID)
  - name: string
  - price: ProductPrice (VO)
  - sku: SKU (VO)
  - stockQuantity: Quantity (VO)

Value Objects to create:
  - ProductPrice: monetary value > 0, 2 decimal places
  - SKU: non-empty string, format [A-Z0-9-]+
  - Quantity: integer >= 0

Entity invariants:
  - Product with stockQuantity = 0 is valid (out of stock, not invalid)

Use-case invariants (NOT in the entity):
  - Checkout blocked if stockQuantity < requested quantity
```

Wait for approval before generating code.
