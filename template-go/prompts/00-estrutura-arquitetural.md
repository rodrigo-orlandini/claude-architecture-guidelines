# 00 Estrutura Arquitetural

## Objetivo

Aplicar a estrutura padrão em Go (monolito modular + Clean Architecture + skills/agentes Claude Code) ao {{PROJECT_NAME}}.

## Contexto

Prompt inicial do projeto, anterior a qualquer feature. Estrutura copiada de `_architecture/template-go/` (variante Go do kit originado no projeto CaseCellShop, em TypeScript).

## Prompt

```
Leia <caminho>/_architecture/README.md e siga BOOTSTRAP-GO.md para aplicar a estrutura neste projeto.
Nome do projeto: {{PROJECT_NAME}}. Domínio: <descrição curta>.
```

## Critérios de Direcionamento

Estrutura já validada em outro projeto (TS) e portada para Go preservando os princípios (monolito modular, regra de dependência, TDD, observabilidade) com o mecanismo idiomático da linguagem (interfaces sem prefixo `I`, `(T, error)` em vez de `Either`, wiring manual em vez de container de DI, `net/http` nativo em vez de framework). O prompt só aponta para o kit e informa nome e domínio; decisões de arquitetura não são re-discutidas.

## Resultado

<preencher: o que foi gerado, o que foi ajustado>

## Revisões

Nenhuma.
