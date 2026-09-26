---
name: domain-modeler
description: Modelagem de domínio {{PROJECT_NAME}}. Use antes de criar qualquer entity ou value-object. Extrai VOs, define invariantes e valida nomenclatura contra CONTEXT.md.
---

# Domain Modeler — {{PROJECT_NAME}}

## Processo

### 1. Contexto
Leia `CONTEXT.md` e o módulo em questão (`src/modules/<módulo>/entities/`).

### 2. Identificar candidatos a Value Object

Para cada campo da entity proposta, pergunte:
- Tem validação própria? (formato, range, regra de negócio)
- Tem comportamento próprio? (métodos, transformações)
- É comparado por valor, não por identidade?

Se sim para qualquer um → é VO.

Exemplos de extração:
```
Price       → não pode ser negativo, arredondamento monetário
SKU / Code  → formato validado (ex: regex)
Quantity    → inteiro positivo, sem zero
Status      → enum com transições válidas (ex: PENDING → PROCESSING → CONFIRMED | FAILED)
Email       → formato validado, normalizado em lowercase
```

VO segue o padrão: construtor privado + `static create(raw): Either<InvalidXError, X>`.
Referência: `entities/value-objects/` do módulo de referência (`src/modules/example/` enquanto existir: `item-name.ts` para VO simples, `item-status.ts` para enum com transições).

### 3. Definir invariantes da entity

Para cada regra de negócio identificada, decida:
- Pertence à **entity** (invariante estrutural — ex: "preço não pode ser negativo")
- Pertence ao **use-case** (regra de aplicação — ex: "estoque insuficiente bloqueia checkout")

Nunca coloque regra de aplicação dentro da entity.

### 4. Validar nomenclatura

- Nome da entity alinhado com `CONTEXT.md`? Se não, proponha atualização do glossário
- VOs em `entities/value-objects/` com nome explícito (ex: `product-price.ts`, não `price.ts`)

### 5. Saída

Antes de qualquer código, apresente:

```
Entity: <Nome>
Campos:
  - id: string (UUID)
  - <campo>: <Tipo> (VO | primitivo)

Value Objects a criar:
  - <Vo>: <regra>

Invariantes da entity:
  - ...

Invariantes do use-case (NÃO na entity):
  - ...
```

Aguarde aprovação antes de gerar código. Após aprovação, atualize `CONTEXT.md`.
