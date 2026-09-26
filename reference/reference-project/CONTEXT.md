# Reference Project Domain

Living glossary. Updated as domain modeling progresses.
Referenced by the `domain-modeler`, `tdd`, and `improve-codebase-architecture` skills.

## Entities and Concepts

- **Product** — catalog item with SKU, name, price, and stock availability
- **Order** — order started at checkout, processed asynchronously by the worker
- **OrderStatus** — order state: `PENDING` | `PROCESSING` | `CONFIRMED` | `FAILED`
- **Stock** — quantity of a Product available in the ERP; read via cache with fallback to the ERP
- **ERP** — fictional external billing and stock-control system; accessed via `erp-adapter`

## Modules

- **catalog** — exposes the product storefront with Redis cache; source of truth: ERP (via adapter)
- **checkout** — receives the order, reserves stock, processes asynchronously, notifies the ERP
- **erp-adapter** — adapter for the fictional ERP; encapsulates retry, timeout, and fallback

## Main Flows

- `GET /products` — returns the catalog with cache (configurable TTL); hit/miss instrumented
- `POST /checkout` — returns 202 Accepted + orderId; worker processes in the background
- `GET /orders/:orderId/status` — queries order status by orderId

## Domain Invariants

- Product cannot have a negative price
- Order cannot be created with quantity > available stock (overselling forbidden)
- Order is idempotent via the `idempotency-key` header — double click generates a single order
