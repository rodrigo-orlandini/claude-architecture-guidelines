# BOOTSTRAP — escolha a stack

Este kit tem uma variante por stack. Este arquivo só decide qual seguir; o roteiro executável está no arquivo específico.

- **TypeScript** (Fastify + tsyringe + Prisma + Vitest): siga [`BOOTSTRAP-TS.md`](./BOOTSTRAP-TS.md)
- **Go** (net/http nativo + sqlc + pgx): siga [`BOOTSTRAP-GO.md`](./BOOTSTRAP-GO.md)

Se o usuário já disse a stack (no prompt, ou porque o projeto de destino já tem `go.mod`/`package.json`), vá direto para o arquivo correspondente sem perguntar. Se não disse e não há como inferir, pergunte antes de prosseguir — as duas variantes têm scaffolds e comandos de validação completamente diferentes, então escolher errado significa refazer o trabalho.

Ambas as variantes compartilham:
- `SETUP.md` — pré-requisitos e configuração da máquina/Claude Code (seções marcadas **[TS]** ou **[Go]** onde divergem)
- Os mesmos princípios de arquitetura (monolito modular, regra de dependência, TDD, observabilidade desde o início) e o mesmo fluxo de sessão (`session-start` → `brainstorming` → `writing-plans` → `tdd-agent` → `observability-enforcer` → `arch-reviewer` → PR) — só o mecanismo idiomático de cada camada muda

Uma nova stack (Python, outra) é uma nova pasta `template-<stack>/` + `BOOTSTRAP-<STACK>.md`, seguindo a mesma forma: mesmos princípios de `docs/architecture.md`/`docs/architecture-rules.md`, mecanismo idiomático da linguagem nova.
