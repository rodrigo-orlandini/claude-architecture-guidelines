# 05 — Asynchronous Checkout

## Goal

Implement the asynchronous checkout flow with stock reservation, Transactional Outbox Pattern, idempotency, and order status lookup.

## Context

The platform has no purchase endpoint. Customers need to complete orders without the system being blocked waiting on ERP billing — which can take a while or fail. Additionally, concurrent purchases against the same product need to be controlled to avoid overselling.

## Prompt

> Let's implement the asynchronous checkout flow. When the customer completes a purchase, the system must reserve stock immediately to avoid overselling, register the order, and publish the processing event using the Transactional Outbox Pattern, returning 202 Accepted without waiting for ERP billing.
>
> The main endpoint is `POST /checkout`, which receives `customerId`, `correlationId` (optional, server-generated if absent), and `items[]` with `productId` and `quantity`. The `Idempotency-Key` header (UUID) is required to tolerate retries and double clicks. The response must return `orderId` and `status: PENDING`.
>
> To track the order, we need `GET /orders/{orderId}/status` with JWT authentication. Customers can only view their own orders; internal staff can see all of them. The response includes `status` (PENDING, PROCESSING, CONFIRMED, FAILED, FAILED_PERMANENT), `attempts`, `lastError`, `createdAt`, and `updatedAt`.
>
> For stock reservation, we reserve the quantity at the start of checkout — if the purchase isn't completed within a time limit, we return it to stock. For idempotency, we create a unique key in the database with a processing status (pending → processing → complete), relying on the database's uniqueness constraint.
>
> The Transactional Outbox guarantees that the order and the event are recorded in the same transaction before publishing to the queue. Workers consume the queue and update the status in the database. Retry with exponential backoff, DLQ for permanent failures. Let's use superpowers to refine this design before implementing it.

## Steering Criteria

_To be filled in after brainstorming_

## Result

_To be filled in after implementation_

## Revisions

_To be filled in if there are iterations_
