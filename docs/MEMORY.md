# Convenções deste fork

Preferências de commit, teste e trabalho para agentes de IA e humanos neste
repositório. Arquitetura: [../CLAUDE.md](../CLAUDE.md). Regras de execução de
plano e armadilhas: [../plans/README.md](../plans/README.md).

---

## Commits

- **Conventional commits**: `fix:`, `feat:`, `refactor:`, `docs:`, `test:`,
  `chore:`, `style:`.
- **Sem emoji** em mensagem de commit, comentário ou PR.
- **Sem `Co-authored-by`** e sem rodapé "Generated with Claude Code".
- Assunto curto e descritivo. Corpo só quando o *porquê* não é óbvio pelo diff —
  e aí explique a decisão, não o que o código faz.
- Commit cita o plano quando houver (`Implements plans/10a`).
- `fixup!` para o que deve ser esmagado depois com `git rebase --autosquash`.

**Push exige autorização explícita do dono.** A `main` é o que o Docker builda —
publicar ali mexe no ambiente de produção dele. Commit local à vontade.

## Branches e PRs

O fluxo hoje é **commit direto na `main`**. Os PRs `#1`–`#3` do início do fork
foram squash-merged e não são mais a norma.

Se abrir PR: contra `main`, branch nomeada `fix/`, `feat/`, `refactor/`. Sem
template — os do upstream foram removidos em 2026-07-17: mandavam quem abrisse
issue aqui para as discussions do `chrisvel/tududi` e afirmavam que
`npm run pre-push` roda testes (não roda).

**CI é o portão real** (`.github/workflows/ci.yml`, roda em push e PR na `main`):
lint, typecheck, testes de backend e `npm audit`.

## Testes

- Backend: `npm run backend:test` (também `npm test`) — 114 suítes / 1644 testes.
- Frontend: `npm run frontend:test` — 6 suítes / 96 testes.
- `npm run pre-push` **só roda `lint-staged`** — não roda teste, e não há hook
  de pre-push instalado. Rode a suíte à mão antes de push.
- `npm run test:watch` é só frontend.
- **Baseline antes de mudar**: rode a suíte *antes* de tocar em qualquer coisa e
  registre o resultado. Vermelho na baseline = pare e reporte; não foi você.

### Organização

- `backend/tests/unit/` — **aninhado por módulo** (`modules/tasks/`,
  `modules/caldav/`, `middleware/`, `models/`).
- `backend/tests/integration/` — **flat**, 57 arquivos (só `mcp/` tem subpasta).
- Frontend — **colocado** com o componente, em `__tests__/` irmão. Não há suíte
  central; `frontend/__tests__/` só tem `setup.ts`.
- Padrão Arrange-Act-Assert. Detalhes e mocks: [testing.md](testing.md).

### Mocks que não são opcionais

- Frontend **não usa `msw`** — mock é `jest.mock` direto no módulo.
- Mocke `fetchWithCsrf`, não o `fetch` global: o real busca `/api/csrf-token` na
  primeira chamada.
- `useToast` **lança** fora do `ToastProvider`; `useBranding` faz fetch no mount.
- R2 nos testes de backend: `aws-sdk-client-mock` contra o client compartilhado
  do `r2Service`. Referência: `task-attachments.test.js`.
- `r2Service.deleteObject` é **best-effort**: loga e retorna `false`, não lança.
  Teste de falha de storage deve esperar 2xx mesmo assim.

## Padrões de código

- **Backend**: padrão de módulo (`routes` → `controller` → `service` →
  `repository`). Lógica de negócio no service, acesso a dados no repository.
  Detalhes: [backend-patterns.md](backend-patterns.md).
- **Frontend**: TypeScript em componente novo. Zustand para estado global, SWR
  para estado de servidor. Organização: [directory-structure.md](directory-structure.md).
- **Lint**: `npm run backend:lint` (global) falha com milhares de `Delete ␍` em
  checkout Windows — ruído de CRLF, pré-existente, não é seu bug. Linte só os
  arquivos que você tocou: `npx eslint caminho/do/arquivo.js`.

## Armadilhas

Fonte única: **[../plans/README.md](../plans/README.md#armadilhas)**. A que mais
custou caro, repetida aqui porque mata:

> **`npm run db:init` e `npm run db:reset` apagam o banco** —
> `sequelize.sync({ force: true })`. Zeraram a produção duas vezes. Num banco
> que **já existe**, nunca rode: use `db:migrate` para migrations pendentes e
> `db:status` para olhar. Num banco que **não existe**, `db:init` é o caminho
> certo — `db:migrate` sozinho gera schema quebrado em silêncio (ver
> [../CLAUDE.md](../CLAUDE.md)).

---

**Atualizado:** 2026-07-17 — reescrito. A versão anterior (2026-04-20) mandava
seguir templates de PR e de issue do upstream, descrevia um fluxo de
contribuição que este fork não tem, e não conhecia R2, branding, backup nem o
`/plans`.
