---
name: session-start
description: Onboarding de sessão {{PROJECT_NAME}}. Carrega contexto do projeto, mostra estado atual e direciona para skill/agente correto. Invoque no início de toda sessão nova.
---

# Session Start — {{PROJECT_NAME}}

## O que fazer

1. Leia `CONTEXT.md` — glossário de domínio
2. Leia `docs/architecture-rules.md` — regras de arquitetura
3. Leia `docs/architecture.md` — design da estrutura
4. Liste specs e planos recentes em `docs/superpowers/specs/` e `docs/superpowers/plans/`
5. Liste módulos existentes em `internal/modules/` e seus use-cases (`go list ./internal/modules/...`)
6. Rode `git status` e `git log --oneline -5`
7. Mostre estado resumido ao usuário

## Saída esperada

```
## Sessão {{PROJECT_NAME}} iniciada

**Branch:** <branch atual>
**Módulos:**
- <módulo>: [use-cases existentes ou "vazio"]

**Shared platform:** httperr ✅ | observability (logger/metrics/tracer) ✅ | db (pool + migrate) ✅

**Último spec/plano:** <arquivo>

**Qual tarefa vamos executar hoje?**
```

## Direcionamento por tipo de tarefa

| Tarefa declarada | Skill/agente |
|---|---|
| Nova feature complexa / decisão arquitetural | `superpowers:brainstorming` → spec → `superpowers:writing-plans` |
| Executar plano aprovado | `superpowers:subagent-driven-development` |
| Modelar entity, VO ou definir invariantes | `/domain-modeler` |
| Implementar use-case, entity, repository | Agente `tdd-agent` |
| Bug / falha de teste | `superpowers:systematic-debugging` |
| Verificar observabilidade | `/observability-enforcer` |
| Revisar diff antes do commit | Agente `arch-reviewer` |
| Antes de fechar qualquer tarefa | `superpowers:verification-before-completion` |
| Finalizar branch / abrir PR | `superpowers:finishing-a-development-branch` |

Lembrete: toda tarefa nova começa em branch nova a partir de `origin/main` e termina em PR.
