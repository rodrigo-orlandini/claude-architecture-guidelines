# Domínio {{PROJECT_NAME}}

Glossário vivo. Atualizado conforme a modelagem de domínio avança.
Referenciado pelas skills `domain-modeler`, `tdd`, `session-start` e `improve-codebase-architecture`.

> Preencha durante o brainstorming inicial. Use exatamente estes nomes no código.
> Exemplo real preenchido: `_architecture/reference/casecellshop/CONTEXT.md`.

## Entidades e Conceitos

- **Item** — entidade de exemplo do módulo `example` (remova junto com o módulo)
- **<Entidade>** — <definição de uma linha>

## Módulos

- **example** — módulo de referência com todas as camadas; apagar quando houver módulo real
- **<módulo>** — <responsabilidade>; fonte de verdade: <onde>

## Fluxos Principais

- `POST /items` — cria item ACTIVE; 422 `INVALID_ITEM_NAME` se nome inválido (exemplo)
- `GET /items` — lista paginada de itens (exemplo)
- `GET /items/:id` — item por id; 404 com `ITEM_NOT_FOUND` (exemplo)
- `<MÉTODO> /<rota>` — <o que faz>

## Invariantes de Domínio

- Item precisa de nome não vazio com no máximo 120 caracteres (exemplo)
- Item nasce ACTIVE; só transita ACTIVE → ARCHIVED; ARCHIVED é terminal (exemplo)
- <regra que nunca pode ser violada>
