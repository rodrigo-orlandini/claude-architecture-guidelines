---
name: domain-modeler
description: Modelagem de domínio {{PROJECT_NAME}}. Use antes de criar qualquer entity ou value object. Extrai VOs, define invariantes e valida nomenclatura contra CONTEXT.md.
---

# Domain Modeler — {{PROJECT_NAME}}

## Processo

### 1. Contexto
Leia `CONTEXT.md` e o módulo em questão (`internal/modules/<módulo>/domain/`).

### 2. Identificar candidatos a Value Object

Para cada campo da entity proposta, pergunte:
- Tem validação própria? (formato, range, regra de negócio)
- Tem comportamento próprio? (métodos, transformações)
- É comparado por valor, não por identidade?

Se sim para qualquer um → é VO.

Exemplos de extração:
```
Price       → não pode ser negativo, arredondamento monetário
Code        → formato validado (ex: regex)
Quantity    → inteiro positivo, sem zero
Status      → enum com transições válidas (ex: PENDING → PROCESSING → CONFIRMED | FAILED)
Email       → formato validado, normalizado em lowercase
```

Em Go, VO é um struct com campo não exportado + construtor `New<Vo>(raw) (<Vo>, error)` — o campo não exportado substitui o "construtor privado" do kit TS, já que só o próprio pacote pode montar o valor diretamente. Enum é um named string type com consts e (quando houver máquina de estados) um método `TransitionTo`.

Referência: `internal/modules/example/domain/` enquanto existir (`item_name.go` para VO simples, `item_status.go` para enum com transições).

### 3. Definir invariantes da entity

Para cada regra de negócio identificada, decida:
- Pertence à **entity** (invariante estrutural — ex: "preço não pode ser negativo")
- Pertence ao **use-case** (regra de aplicação — ex: "estoque insuficiente bloqueia checkout")

Nunca coloque regra de aplicação dentro da entity.

### 4. Validar nomenclatura

- Nome da entity alinhado com `CONTEXT.md`? Se não, proponha atualização do glossário
- Sem prefixo `I` em interfaces (Go não usa Hungarian notation) — a porta é só `ItemRepository`, definida no pacote `usecase` que a consome
- Pacotes em uma palavra minúscula (`domain`, `usecase`, não `use_cases` nem `useCases`); arquivos em `snake_case.go`

### 5. Saída

Antes de qualquer código, apresente:

```
Entity: <Nome>
Campos:
  - ID: string (UUID)
  - <campo>: <Tipo> (VO | primitivo)

Value Objects a criar:
  - <Vo>: <regra>

Invariantes da entity:
  - ...

Invariantes do use-case (NÃO na entity):
  - ...
```

Aguarde aprovação antes de gerar código. Após aprovação, atualize `CONTEXT.md`.
