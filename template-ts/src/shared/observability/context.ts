import { AsyncLocalStorage } from 'node:async_hooks'

// correlationId sempre presente; ids de negócio (ex.: orderId, userId) entram via addToContext
// e aparecem automaticamente em todo log de getLogger() dentro do mesmo fluxo assíncrono.
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

// Junta ids ao contexto atual sem perder correlationId. Sem contexto ativo (ex.: job fora de request), não faz nada.
export function addToContext(ids: Record<string, string>): void {
  const current = als.getStore()
  if (current) Object.assign(current, ids)
}
