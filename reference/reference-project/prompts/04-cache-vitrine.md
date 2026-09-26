# 04 — Storefront Cache

## Goal

Add cache layers to the storefront (product listing), reducing database load and increasing resilience.

## Context

The storefront exposes `GET /products` via `ListProductsUseCase`. Without cache, every request goes straight to Postgres. As traffic grows, reads need to be protected by a cache.

## Prompt

> Let's work on the cache layers for the storefront. Let's follow an approach with local cache, cache-aside, and refresh ahead. Add a local cache in the application that will serve as a first line to filter requests to the database and as a fallback in case the next cache layer fails, which would be a cache-aside with the Redis we already have configured. Use a TTL of around 10 minutes, with a strategy of adding jitter (plus or minus 10 seconds) to avoid all keys expiring together, but with an invalidation mechanism tied to the sync service between the ERP and the store's database, so that whenever a change happens to a product, the sync service invalidates the stale cache and registers a new one in both layers. When the TTL is close to expiring, to avoid cache stampede, we can also use the refresh-ahead strategy to anticipate cache renewal with a separate worker to handle the scheduling of that renewal.

## Steering Criteria

_To be filled in after brainstorming_

## Result

_To be filled in after implementation_

## Revisions

_To be filled in if there are iterations_
