---
name: observability-enforcer
description: Checklist de observabilidade {{PROJECT_NAME}}. Execute antes de fechar qualquer use-case ou handler. Verifica correlationId, métricas, spans e ausência de log não estruturado.
---

# Observability Enforcer — {{PROJECT_NAME}}

Checklist executado sobre o arquivo ou módulo indicado. Reporte apenas itens faltando.

## Checklist

### Logger estruturado
- [ ] `fmt.Println` / `log.Println` / `println` ausentes em todo arquivo analisado (exceção: erro fatal de bootstrap em `cmd/api/main.go`, que ainda não tem logger inicializado)
- [ ] Logs via `observability.FromContext(ctx)` — nunca `slog.Default()` direto num handler ou use-case (perde correlationId/traceId)
- [ ] IDs de negócio relevantes (ex: `orderId`) adicionados com `observability.AddFields(ctx, map[string]string{...})` assim que existirem — todo `FromContext` seguinte no mesmo request os inclui

### Métricas (`internal/platform/observability/metrics.go`)
- [ ] Toda operação de negócio relevante tem Counter (`<dominio>_<evento>_total`)
- [ ] Falhas relevantes têm Counter com label de motivo (`prometheus.CounterVec` com `reason` ou similar)
- [ ] Operações com latência relevante têm Histogram (`<dominio>_<operacao>_duration_ms`)
- [ ] Toda métrica nova está registrada no `Registry` (bloco `init()` de `metrics.go`) — sem isso não aparece em `/metrics`

### Tracing (`internal/platform/observability/tracer.go`)
- [ ] Span raiz `http.request`-equivalente já vem do middleware — handlers HTTP não abrem span próprio para a própria rota
- [ ] Span filho em use-cases críticos: `ctx, span := observability.Tracer("<módulo>").Start(ctx, "<módulo>.<ação>")` com `defer span.End()`
- [ ] IDs de negócio como atributo do span (`span.SetAttributes(...)`) quando relevante
- [ ] Span propagado via `ctx` para chamadas externas (HTTP, fila, adapter) — nunca `context.Background()` criado no meio de um fluxo de request

### Erros
- [ ] `httperr.DomainError.Code` presente e mapeado em `internal/platform/httperr/error.go`
- [ ] Handler usa `errors.As` para decidir status — nunca `err.Error()` comparado por string
- [ ] Stack trace / erro interno NÃO exposto ao cliente (mensagem genérica em 500; detalhe só no log)

## Formato de saída

```
✅ correlationId propagado
✅ logger estruturado em uso
❌ métrica de falha ausente em create_order.go
❌ span ausente em order_handler.go
```

Items ausentes bloqueiam a tarefa — adicione antes de seguir para arch-reviewer.
