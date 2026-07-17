# Tududi — Developer Guide

Guia de arquitetura deste fork, para humanos e agentes de IA. Documentação de
usuário: [README.md](README.md). O que difere do upstream:
[docs/fork-changelog.md](docs/fork-changelog.md).

---

## ⚠️ Leia antes de rodar qualquer comando

**`npm run db:init` e `npm run db:reset` DESTROEM o banco.** Os dois são
`sequelize.sync({ force: true })` — DROP de todas as tabelas. Foi esse comando,
disparado no boot, que zerou a produção duas vezes em julho/2026.

A regra depende do estado do banco:

| Situação | Comando |
|---|---|
| Banco **não existe** (clone novo) | `db:init` — é o caminho certo, cria o schema a partir dos models |
| Banco **existe** | **nunca** `db:init`. `db:migrate` aplica as migrations pendentes |
| Só quero olhar | `db:status` (só lê) |

**`db:migrate` não bootstrapa um banco vazio.** A ordem alfabética faz
`20250116...-add-first-day-of-week-to-users` rodar antes de
`20250615...-create-users`; `safeAddColumns` não acha a tabela, pula em silêncio
e a migration é marcada como executada — a coluna nunca é criada, e o
`User.js:69` a espera. Por isso `backend/cmd/start.sh:92` só chama `db-init`
quando o arquivo não existe, e migra depois.

Demais armadilhas (o compose não builda seu código local; `NODE_ENV`; lint
global quebrado no Windows; push só com autorização): **[plans/README.md](plans/README.md#armadilhas)**
— fonte única, não duplicada aqui.

---

## Quick Start

Gerenciador de tarefas self-hosted com hierarquia Areas > Goals > Projects >
Tasks, tarefas recorrentes e integrações multi-canal.

```bash
git clone git@github.com:luciancsilva/tasks.git
cd tasks
npm install
npm run db:init       # só na primeira vez — ver o aviso acima
npm start             # frontend :8080, backend :3002
```

Testes: `npm run backend:test` (114 suítes / 1644) e `npm run frontend:test` (6 / 96).

---

## Stack

**Frontend:** React 18 + TypeScript 5.6, Webpack 5 (não Vite), Tailwind 3.4 +
Heroicons, Zustand (estado global) + SWR (estado de servidor), React Router 6,
i18next (24 idiomas).

**Backend:** Express 4.21 + Sequelize 6.37, SQLite 5.1 (WAL), Cloudflare R2 para
object storage e snapshots do banco, bcrypt + express-session, Swagger, Multer +
multer-s3, node-cron, Nodemailer.

**Testes:** Jest (backend + frontend), Playwright (E2E), Supertest (integração).

> O Cloudflare D1 foi tentado e **removido** em 2026-07-17: 1 round-trip HTTP por
> statement, sem transação real. Referência a D1 em qualquer lugar é resíduo —
> ver [`plans/09a-d1-code-removal.md`](plans/09a-d1-code-removal.md).

---

## Caminhos críticos

| Tarefa | Onde |
|---|---|
| Feature backend | `/backend/modules/[feature]/` (routes + controller + service + repository) |
| Model | `/backend/models/[model].js` |
| Migration | `/backend/migrations/` |
| Componente React | `/frontend/components/[Feature]/` |
| Estado global | `/frontend/store/useStore.ts` |
| Client de API | `/frontend/utils/[resource]Service.ts` |
| Object storage (R2) | `/backend/services/r2Service.js` |
| Backup do banco | `/backend/services/dbBackupService.js` |
| Branding | `/backend/modules/branding/`, `/frontend/contexts/BrandingContext.tsx` |
| Planos executáveis | `/plans/` (regras em `/plans/README.md`) |

---

## Índice da documentação

### Arquitetura e processo

| Doc | O quê |
|---|---|
| [architecture.md](docs/architecture.md) | Stack, fluxo de request, modelo de dados, autenticação |
| [directory-structure.md](docs/directory-structure.md) | Árvore de arquivos e caminhos críticos |
| [backend-patterns.md](docs/backend-patterns.md) | Padrão de módulo; como adicionar um |
| [database.md](docs/database.md) | Models, relacionamentos, workflow de migration |
| [backups.md](docs/backups.md) | Snapshot pro R2, retenção e **procedimento de restore** |
| [development-workflow.md](docs/development-workflow.md) | Setup, dois servidores, env vars, adicionar feature |
| [code-conventions.md](docs/code-conventions.md) | TS/JS, async/await, nomenclatura, rotas |
| [testing.md](docs/testing.md) | Organização, comandos, padrões de mock |
| [common-tasks.md](docs/common-tasks.md) | Receitas: campo novo, módulo novo, componente, TDD |
| [MEMORY.md](docs/MEMORY.md) | Convenções de commit e teste deste fork |
| [fork-changelog.md](docs/fork-changelog.md) | O que este fork tem que o upstream não tem |

### Comportamento do produto

| Doc | O quê |
|---|---|
| [00-tasks-behavior.md](docs/00-tasks-behavior.md) | Ciclo de vida, prioridade, datas, subtasks, anexos, hábitos |
| [01-recurring-tasks-behavior.md](docs/01-recurring-tasks-behavior.md) | Recorrência, instâncias virtuais, pai-filho |
| [02-today-page-sections.md](docs/02-today-page-sections.md) | Overdue, Planned, Suggested, Completed |
| [03-upcoming-view.md](docs/03-upcoming-view.md) | Os 7 dias, agrupamento, ocorrências virtuais |
| [04-inbox-page.md](docs/04-inbox-page.md) | Captura rápida, parsing, sugestões, Telegram |
| [05-notes-system.md](docs/05-notes-system.md) | Markdown, auto-save, focus mode, cores |
| [06-projects.md](docs/06-projects.md) | Hierarquia, status, stalled, compartilhamento, deleção |
| [07-areas.md](docs/07-areas.md) | Categorias de topo; contêiner de Goals e Projects |
| [08-user-management.md](docs/08-user-management.md) | Registro, auth, roles, permissões, API tokens |
| [08-views-system.md](docs/08-views-system.md) | Saved searches, pin na sidebar, filtros |
| [09-tags-system.md](docs/09-tags-system.md) | Tags entre entidades, auto-criação, hashtags |
| [12-goals-system.md](docs/12-goals-system.md) | Intenções entre Areas e Projects; horizontes |
| [13-ai-assistant.md](docs/13-ai-assistant.md) | Daily Brief e insights (OpenAI, `OPENAI_API_KEY`) |

> Os dois docs com prefixo `08` são colisão de numeração herdada do upstream.
> Renomear quebraria links existentes; ficam como estão.

### Integrações e infra

| Doc | O quê |
|---|---|
| [14-mcp-integration.md](docs/14-mcp-integration.md) | MCP server, 16 tools, stdio e HTTP |
| [10-oidc-sso.md](docs/10-oidc-sso.md) | SSO via provider OIDC externo |
| [11-caldav-sync.md](docs/11-caldav-sync.md) | Sync bidirecional com CalDAV |
| [15-storage.md](docs/15-storage.md) | R2: prefixos, proxy `/api/uploads/`, deleção best-effort |
| [16-branding.md](docs/16-branding.md) | Nome, logos e favicon por instância |

---

## Sobre este fork

Fork pessoal de [chrisvel/tududi](https://github.com/chrisvel/tududi), self-hosted
via Docker. Diverge em PT-BR integral, storage em R2, backup offsite e correções
de estabilidade — lista completa em [docs/fork-changelog.md](docs/fork-changelog.md).

Sincronização com o upstream é eventual e seletiva: [git-review.md](git-review.md).

**Filosofia do projeto original** — [Designing a Life Management System That
Doesn't Fight Back](https://medium.com/@chrisveleris/designing-a-life-management-system-that-doesnt-fight-back-2fd58773e857).

### Arquivos de instrução para agentes

| Arquivo | Escopo |
|---|---|
| **CLAUDE.md** | Este arquivo — arquitetura, índice, armadilhas |
| [plans/README.md](plans/README.md) | Regras de execução de plano + armadilhas (fonte única) |
| [docs/MEMORY.md](docs/MEMORY.md) | Convenções de commit e teste |
| `.github/copilot-instructions.md` | Estilo de resposta (caveman) |
| `AGENTS.md` | Ponteiros + estilo. **Gitignored** — só existe no checkout local |

---

**Versão:** 2.0.0 — **Atualizado:** 2026-07-17 (índice compactado; Quick Start
corrigido: clonava o upstream e mandava rodar `db:init`, que apaga o banco)
