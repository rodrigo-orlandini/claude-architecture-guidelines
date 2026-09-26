import { AsyncLocalStorage } from 'node:async_hooks'

// correlationId is always present; business ids (e.g. orderId, userId) enter via addToContext
// and automatically appear in every getLogger() log within the same async flow.
export interface ObsContext {
  correlationId: string
  [businessId: string]: string | undefined
}

const als = new AsyncLocalStorage<ObsContext>()

export function runWithContext<T>(ctx: ObsContext, fn: () => T): T {
  return als.run(ctx, fn)
}

export function getContext(): ObsContext | undefined {
  return als.getStore()
}

export function enterContext(ctx: ObsContext): void {
  als.enterWith(ctx)
}

// Merges ids into the current context without losing correlationId. With no active context (e.g. a job outside a request), it does nothing.
export function addToContext(ids: Record<string, string>): void {
  const current = als.getStore()
  if (current) Object.assign(current, ids)
}
