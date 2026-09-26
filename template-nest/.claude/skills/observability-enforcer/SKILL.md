---
name: observability-enforcer
description: Observability checklist for {{PROJECT_NAME}}. Run before closing any use-case or controller. Checks correlationId always, and metrics/spans only if telemetry was enabled for this project.
---

# Observability Enforcer — {{PROJECT_NAME}}

Checklist run against the indicated file or module. Report only missing items.

**First, check which layer applies:** does `src/shared/observability/metrics.ts` exist in this project? If not, telemetry was declined at bootstrap — skip the "Metrics" and "Tracing" sections entirely and only check "Structured logger" and "Errors" below. Don't flag metrics/spans as missing in a project that opted out; that's not a gap, it's the declared setup (see `CONTEXT.md`, "Optional Layers Enabled").

## Checklist

### Structured logger (always applies)
- [ ] `console.log` absent from every analyzed file (exception: bootstrap fatal in `src/main.ts`)
- [ ] Logger (pino) imported from `shared/observability/logger.ts`
- [ ] `correlationId` present in every request log (`x-correlation-id` header or generated)
- [ ] Business ids (e.g. `orderId`) present in logs of any order-like flow

### Metrics (only if `shared/observability/metrics.ts` exists)
- [ ] Relevant business operation instrumented: `metrics.<name>.inc()`
- [ ] Relevant failure instrumented with a reason label
- [ ] Latency recorded via histogram where relevant

### Tracing (only if `shared/observability/tracer.ts` exists)
- [ ] Span created for critical use-cases (includes relevant attributes)
- [ ] Span propagated to external calls (HTTP, adapter)

### Errors (always applies)
- [ ] `error.code` present (the DomainError's code)
- [ ] `error.message` present
- [ ] `correlationId` present
- [ ] Stack trace NOT exposed to the client (internal log only)

## Output format

```
✅ correlationId propagated
✅ pino logger in use
❌ failure metric missing in create-item.ts (skip this line if metrics.ts doesn't exist in this project)
```

Missing items block the task — add them before moving on to arch-reviewer. An item that doesn't apply because telemetry was declined is not "missing"; don't report it.
