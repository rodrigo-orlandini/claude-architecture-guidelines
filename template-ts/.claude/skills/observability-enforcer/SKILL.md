---
name: observability-enforcer
description: Checklist de observabilidade {{PROJECT_NAME}}. Execute antes de fechar qualquer use-case ou controller. Verifica correlationId, métricas, spans e ausência de console.log.
---

# Observability Enforcer — {{PROJECT_NAME}}

Checklist executado sobre o arquivo ou módulo indicado. Reporte apenas itens faltando.

## Checklist

### Logger estruturado
- [ ] `console.log` ausente em todo arquivo analisado (exceção: erro fatal de bootstrap em `src/main.ts`)
- [ ] Logs de use-case/infra via `getLogger()` de `@shared/observability/logger` (injeta `correlationId`, `traceId`, `spanId` automaticamente)
- [ ] Logs de controller via `request.log` com `correlationId: request.correlationId`
- [ ] IDs de negócio relevantes (ex: `orderId`, `userId`) presentes nos logs do fluxo — chamar `addToContext({ orderId })` de `@shared/observability/context` assim que o id existir; todo `getLogger()` seguinte o inclui

### Métricas (`@shared/observability/metrics`)
- [ ] Toda operação de negócio relevante tem Counter (`<dominio>_<evento>_total`)
- [ ] Falhas têm Counter com label de motivo (`{ reason }` ou `{ permanent }`)
- [ ] Operações com latência relevante (I/O, cache, jobs) têm Histogram (`<dominio>_<op>_duration_ms`)
- [ ] Cache (se houver): hit / miss instrumentados

### Tracing (`@shared/observability/tracer`)
- [ ] Span raiz `http.request` já é criado pelo hook do server — não duplicar
- [ ] Span filho em rotas/use-cases críticos com IDs de negócio como atributo (`<entidade>.id`)
- [ ] Span propagado para chamadas externas (HTTP, fila, adapter)
- [ ] `span.end()` em `finally`; `setStatus({ code: SpanStatusCode.ERROR })` em falha

### Campos obrigatórios em logs de erro
- [ ] `error.code` presente (código do DomainError)
- [ ] `error.message` presente
- [ ] `correlationId` presente
- [ ] Stack trace NÃO exposto ao cliente (apenas no log interno)

## Formato de saída

```
✅ correlationId propagado
✅ logger pino em uso
❌ métrica de falha ausente em create-order.ts
❌ span ausente em order-controller.ts
```

Items ausentes bloqueiam a tarefa — adicione antes de seguir para arch-reviewer.
