# /plans — planos de trabalho executáveis por agentes

Diretório de planos de implementação deste fork. Serve tanto para humanos quanto
para agentes de IA (Claude Code, etc.) que forem executar trabalho aqui.

Os planos são escritos para serem executados **por um agente que não conhece o
repo**. Cada um traz seu próprio contexto, referências `arquivo:linha` e critério
de pronto. Este README traz o que vale para todos.

## Instruções ao agente — COMECE AQUI

**Ler este arquivo É a instrução de trabalho.** Se o usuário só mandou
"read the @plans/README.md" (ou equivalente), não espere mais contexto:
siga os passos abaixo imediatamente.

1. Leia este arquivo inteiro e o `CLAUDE.md` da raiz.
2. Liste ao usuário os planos **Abertos** (tabelas abaixo) com uma linha de
   descrição cada e **pergunte em qual plano vai trabalhar** — não escolha
   sozinho. Se o usuário já nomeou o plano, pule esta etapa.
3. Confirme as **dependências** do plano escolhido (coluna "Depende de"). Plano
   com dependência aberta não deve ser executado antes dela.
4. Execute o plano do início ao fim **sem pausar para pedir aprovação entre
   etapas**: baseline de testes → implementação → testes/lint → commit citando o
   plano → marcar EXECUTADO e atualizar as tabelas deste README.
5. Só interrompa por decisão que apenas o dono do repositório pode tomar
   (credencial, escolha de produto, mudança de API pública).
6. Ao final, entregue resumo: o que foi feito, resultado dos testes, desvios.

## Armadilhas

⚠️ **Leia antes de rodar qualquer comando.** Cada uma destas já causou estrago
real ou daria falso positivo. Esta seção é a **fonte única** — `CLAUDE.md` e
`docs/MEMORY.md` apontam para cá em vez de duplicar.

1. **`npm run db:init` e `npm run db:reset` DESTROEM o banco.** São
   `sequelize.sync({ force: true })` = DROP de todas as tabelas. Foi exatamente
   esse comando, disparado automaticamente no boot, que zerou o banco de
   produção duas vezes em 2026-07-16/17.
   **Como agente executor, você nunca precisa rodar nenhum dos dois**: o banco
   de dev já existe neste checkout, e a suíte usa `NODE_ENV=test`. Para
   inspecionar, `npm run db:status` (só lê).

   Nuance que não cabe esquecer: num banco que **ainda não existe**, `db:init` é
   o caminho *correto* — é o que `backend/cmd/start.sh:92` faz. `db:migrate`
   sozinho não bootstrapa: a ordem alfabética roda
   `20250116...-add-first-day-of-week-to-users` antes de `20250615...-create-users`,
   `safeAddColumns` pula em silêncio e marca a migration como executada — a
   coluna nunca é criada. O perigo do `db:init` é exclusivamente contra banco que
   **já existe**.
2. **`docker compose up --build` NÃO testa seu código local.** O
   `docker-compose.yml` builda de
   `context: https://github.com/luciancsilva/tasks.git#main` — ou seja, o
   container roda a `main` do GitHub, não o working tree. Smoke test de mudança
   local é com `npm start` (frontend :8080, backend :3002). Só use o compose para
   validar algo que já está na `main`.
3. **`NODE_ENV=test` é o único seguro por construção.** Comando com
   `NODE_ENV=development|production` toca o banco real do checkout. A suíte Jest
   pode rodar à vontade.
4. **Nunca commitar segredo.** `.env` e `AGENTS.md` são gitignored (AGENTS.md
   existe só neste checkout). Se um plano pedir mudança no `.env`, avise o dono —
   não tente versionar.
5. **Não faça `git push` sem autorização explícita** do dono. Commit local sim,
   push não. A `main` é o que o Docker builda: publicar ali afeta o ambiente dele.

## Comandos

Da **raiz** do repo:

```bash
npm run backend:test          # suíte backend inteira (NODE_ENV=test)
npm run backend:test:unit     # só tests/unit
npm run frontend:test         # suíte frontend
npm run db:status             # inspecionar o banco (seguro, só lê)
npm start                     # sobe a app local: frontend :8080, backend :3002
```

De dentro de `backend/` (para o que é pontual):

```bash
npx cross-env NODE_ENV=test npx jest tests/unit/foo.test.js   # um arquivo de teste
npx eslint caminho/do/arquivo.js                              # lint de um arquivo
npx eslint --fix caminho/do/arquivo.js                        # corrige formatação
```

**Obrigatório antes de comitar:** O CI no GitHub Actions tem uma verificação rigorosa de Prettier e **vai quebrar** se houver qualquer desvio. Em checkouts de Windows, rodar o `npm run backend:lint` global gera milhares de erros `Delete ␍` pela diferença de quebra de linha. Para evitar poluir o PR e ao mesmo tempo passar no CI:
1. Após finalizar seu trabalho, identifique quais arquivos do `backend/` você modificou.
2. Rode `cd backend && npx eslint --fix <arquivo1> <arquivo2> ...`.
3. Adicione as mudanças corrigidas e faça o commit.
Se esquecer dessa etapa, seu código quebrará a pipeline de CI.

## Racional

- **Um plano = uma unidade de trabalho commitável.** Cada arquivo descreve algo
  que pode ser implementado, testado e commitado de forma independente. Planos
  grandes são quebrados em menores (`10a`, `10b`, ...) para que cada pedaço seja
  executável isoladamente.
- **Planos citam código real** (`arquivo:linha`), nunca generalidades — o agente
  executor não deve precisar re-investigar o que o plano já investigou, apenas
  validar que as referências continuam verdadeiras.
- **Ciclo de vida**: proposto → executado → **marcado como EXECUTADO** (banner
  no topo) e mantido como registro de decisão. Saem do diretório: planos
  descartados, consumidos sem valor de registro (ex.: prompts de planejamento) e
  **planos de tecnologia removida do código** — quando a tecnologia sai do
  código, o plano dela sai junto.
- **Numeração**: o prefixo `NN-` é **identidade, não posição** — mensagens de
  commit citam o plano pelo número ("Implements plans/05b ME-1"), então um número
  aponta para sempre ao mesmo trabalho. **Números não são reciclados**: buracos
  na sequência (hoje 04, 07, 08) são planos removidos, e reusá-los faria um
  commit antigo apontar para o plano errado. Sufixos de letra agrupam
  segregações de um mesmo trabalho. **A ordem de execução é a das tabelas
  abaixo, não a do número.**

## Estado atual

**Prioridade** é risco, não gosto:
- **Alta** — risco de perda de dados ou de indisponibilidade.
- **Média** — dívida que já causou incidente, ou que bloqueia trabalho futuro.
- **Baixa** — qualidade e consistência, sem risco imediato.

Dentro de cada prioridade, do menor para o maior esforço.

### Prioridade ALTA

*(nenhum plano aberto)*

### Prioridade MÉDIA

Achados da auditoria de descoberta de 2026-07-18 (rodada map-only). Nenhum arrisca
perda de dados em massa, mas há SSRF autenticado, divergência de contadores e
degradação de scheduler.

| Arquivo | O quê | Esforço | Modelo | Depende de |
|---|---|---|---|---|
| `39-ssrf-url-title.md` | SSRF: `/api/url/title` busca qualquer host e segue redirect sem blocklist (loopback/privado/metadata de cloud) | Médio | médio | - |

### Prioridade BAIXA

Achados do code-review do lote 24–32 (2026-07-18) e da auditoria de descoberta de
2026-07-18. Nenhum arrisca dados.

| Arquivo | O quê | Esforço | Modelo | Depende de |
|---|---|---|---|---|

#### Roadmap GTD — Lotes 1-3 (2026-07-18)

Features aprovadas na auditoria GTD (Fases 1-4). Risco baixo (nenhum toca dado
existente sem migration `safeAddColumns`); valor alto. Ordem de execução sugerida
pela coluna "Depende de", não pelo número. 24 planos (`49`-`69`, com `53`/`54`/`67`
quebrados em a/b). Reescritos com detalhe máximo (trechos de código, assinaturas,
shapes de request/response) para execução por modelos menos capazes.

**Lote 1 — GTD core (49-56):** Someday/Waiting nativos, energy/time, sequential
projects, Weekly Review (rota+seções+notif+stale).

**Lote 2 — Engajar (57-62):** multi-tag OR, custom date range, focus mode,
calendar drag, today reorder, quick-add overlay.

**Lote 3 — UX/Inbox (63-69):** bulk ops, subtask drag, inbox stale alert, triage
wizard, task comments, composer `!priority`, inbox bulk.

| Arquivo | O quê | Esforço | Modelo | Depende de |
|---|---|---|---|---|
| `54a-weekly-review-route-checklist.md` | Módulo `reviews` + rotas `/reviews/*` + `User.last_reviewed_at` + rota `/review` + shell + sidebar entry | Alto | médio | - |
| `54b-weekly-review-sections.md` | 7 seções (inbox/stale/stalled/waiting/someday/goals/upcoming) com agregação reusando services + UI ReviewSection | Alto | médio | 54a, 56 |
| `55-weekly-review-notification.md` | Notification type `weekly_review` + pref `weeklyReview` + cron diário 16h filtra por `weekly_review_day` + suggested | Baixo | baixo | 54a |
| `57-multi-tag-and-or.md` | `tags_any` (OR) + `tags` (AND) combináveis + View `tags_any` JSON + SearchMenu dois campos "Todas"/"Qualquer" | Médio | médio | - |
| `58-custom-date-range.md` | `due_from`/`due_to` em `/tasks` + `/search` + View colunas + SearchMenu date pickers (presets mantidos) | Médio | médio | - |
| `59-task-focus-mode.md` | `TaskFocusMode` full-screen + Pomodoro bind (`current_task_uid`) + Next + TaskEvent `focus_session` + endpoint log | Alto | médio | - |
| `60-calendar-drag-reschedule.md` | dnd-kit em CalendarMonthView: drag muda `due_date` + double-click-to-create; defer não-draggable | Alto | médio | - |
| `61-today-plan-reorder.md` | Coluna `today_order` + dnd-kit em TodayPlan; fallback sort se null; drag handle separado | Médio | médio | - |
| `62-quick-add-overlay.md` | Ctrl+Space → overlay mini-input (portal) → Inbox; intercept capture phase (funciona em inputs); token parsing | Médio | médio | - |
| `63-bulk-ops-tasks.md` | `POST /tasks/bulk` atômico (status/priority/due/energy/time/assigned) + `/tasks/bulk-delete` + TaskList checkbox + toolbar | Médio | médio | 51, 52 |
| `64-subtask-drag-reorder.md` | `PATCH /task/:uid/subtasks/reorder` atômico + dnd-kit em TaskSubtasksSection + drag handle `⠿` | Médio | médio | - |
| `65-inbox-stale-alert.md` | `GET /inbox/stale-count` (>48h) + sidebar ponto vermelho + Inbox banner + items destacados | Baixo | baixo | - |
| `66-inbox-triage-wizard.md` | InboxItemDetail footer 6 botões GTD (Ação/2-min/Projeto/Ref/Someday/Lixo) + `analyzeText` parse + `is_someday`/done | Médio | médio | 49 |
| `67a-task-comments-backend.md` | Migration `comments` + model + módulo `comments` (CRUD) + access rw/ro + notif `comment_added` para owner | Médio | médio | - |
| `67b-task-comments-frontend.md` | `TaskCommentsCard` (SWR) + post/edit/delete (autor) + mount TaskDetails + `commentsService.ts` | Médio | médio | 67a |
| `68-composer-priority-token.md` | `parsePriority` (`!high`/`!medium`/`!low`) em `inboxProcessingService` + strip clean + `parsed_priority` em analyzeText | Baixo | baixo | - |
| `69-inbox-bulk-process.md` | `POST /inbox/bulk` (process-to-tasks com shared tags/project) + `/inbox/bulk-delete` + `/inbox/bulk-mark-processed` + selection UI | Médio | médio | 68 |

O lote de correções/melhorias reportado pelo dono em 2026-07-17 (planos 24–32) foi
executado em 2026-07-18 — ver tabela "Executados".

`05-future-improvements.md` é o índice do levantamento que gerou os `05x` — é
registro, não trabalho.

Os riscos que ocupavam a faixa ALTA foram fechados em 2026-07-17: a ausência de
backup offsite pelos `10a`–`10d` (snapshot pro R2, agendado, restore executado).

**Auditoria de authz concluída (2026-07-18):** a varredura de isolamento por usuário
cobriu url (SSRF → plano 39), admin e users (updateProfile — allowlist, limpo) e, na
segunda rodada, `notes`/`tags`/`people`/`views`/`shares`/`goals`. Resultado: `notes`,
`tags`, `people`, `views` **limpos** (toda query escopada por `user_id`); `shares`
limpo quanto a cross-user (só o dono compartilha), com um gap defensivo em
`access_level` → plano 48; `goals` com um IDOR de `area_id` → plano 47. Todos os 6
módulos passam por `requireAuth` (nenhuma rota montada antes de `app.js:384`).

### Executados — registro de decisão, não mexer

| Arquivo | O quê | Status |
|---|---|---|
| `56-stale-task-detection.md` | `case 'stale'` query-builder (`updated_at < cutoff`, não-done, não-recurring/someday/habit) + `stale_days` param + User.stale_task_days | EXECUTADO (2026-07-19) |
| `53b-projects-sequential-frontend.md` | ProjectModal toggle + ProjectBanner badge "Sequential" + ProjectTasksSection callout "Next action" + entity TS | EXECUTADO (2026-07-19) |
| `53a-projects-sequential-backend.md` | `Project.execution_mode` (parallel/sequential) + migration + service + query-builder oculta non-next em Today/Upcoming (bypass project_uid) + MCP | EXECUTADO (2026-07-19) |
| `52-task-time-estimate.md` | Campo `time_estimate` (INTEGER 1-1440) + `time_max` em views; filtros `time_max`/`time_min` (ValidationError→400) + `order_by`; search/views/MCP; TaskTimeEstimateCard + slots SearchMenu/SaveViewModal | EXECUTADO (2026-07-18) |
| `49-gtd-someday-native.md` | `is_someday` flag em tasks + query-builder (someday nativo via flag OR tag `someday` retrocompat) + exclusão em today/upcoming/next/inbox/active + sidebar NavLink + TaskDetails toggle card | EXECUTADO (2026-07-18) |
| `51-task-energy-field.md` | Campo `energy` (0-2) em tasks + STRING em views; `Task.ENERGY`/`getEnergyValue`; filtro `/tasks?energy=` + `order_by=energy`; View `energy` com `validateEnergy`; SearchMenu/Results/SaveViewModal slot; `TaskEnergyCard`; MCP `create/update/list_tasks` | EXECUTADO (2026-07-18) |
| `38-auth-robustness-and-migration-test.md` | Robustez: `requireAuth` full-column select derruba toda auth in drift; migrations não testadas | EXECUTADO (2026-07-18) |
| `50-gtd-waiting-since.md` | `waiting_since` DATE em tasks + auto-set/clear em transição de status + filtro `waiting_overdue_days` no query-builder + sidebar NavLink + TaskDetails card (visível só em waiting) | EXECUTADO (2026-07-18) |
| `41-habits-streak-timezone.md` | Streak de hábito usa `moment-timezone` com o fuso do usuário em vez do fuso do servidor | EXECUTADO (2026-07-18) |
| `44-scheduler-n-plus-1-and-unbounded-findall.md` | Jobs due/deferred: paginação no `findAll` e N+1 de Notificação resolvido | EXECUTADO (2026-07-18) |
| `47-goals-area-ownership-idor.md` | Validação de ownership de Area para Goals; query `getAll` escopada por `user_id` | EXECUTADO (2026-07-18) |
| `46-telegram-summary-timezone.md` | Range "hoje" no resumo Telegram usa local timezone do User | EXECUTADO (2026-07-18) |
| `43-templates-atomicity.md` | Transações Sequelize em `saveProjectAsTemplate`, `cloneTemplate` e `delete` de template | EXECUTADO (2026-07-18) |
| `42-caldav-conflict-resolution-atomicity.md` | Transações Sequelize na resolução CalDAV auto/manual | EXECUTADO (2026-07-18) |
| `40-habits-completion-atomicity.md` | Transações Sequelize em `logCompletion` e `deleteCompletion` de hábitos | EXECUTADO (2026-07-18) |
| `48-shares-access-level-whitelist.md` | `createShare`: whitelist `['ro','rw']` para `access_level`; `ValidationError(400)` para valor inválido | EXECUTADO (2026-07-18) |
| `45-ai-daily-brief-stale-cache.md` | `getCachedBrief` compara `ai_daily_brief_date` com hoje no fuso do usuário; retorna `null` se desatualizado | EXECUTADO (2026-07-18) |
| `37-fix-ai-migration-shape.md` | Migration do plano 32 não aplicava (`safeAddColumns` com shape errado, sem `definition:`) — quebraria o deploy; corrigida e aplicada | EXECUTADO (2026-07-18) |
| `36-templates-error-i18n-and-sentinels.md` | Templates: sentinelas de erro em `TEMPLATE_API_ERROR`, helper `showTemplateError`, fallback EN + chaves `error404/error500` em en+pt | EXECUTADO (2026-07-18) |
| `34-inbox-person-semantics-consistency.md` | Composer da inbox: primeira `@pessoa` vira `assigned_to` (resto InvolvedPeople), consistente com o detail e a decisão do dono | EXECUTADO (2026-07-18) |
| `35-tasks-cleanup-includes-and-i18n-require.md` | 35-2 require i18n hoisted; 35-1/35-3 fechados sem mudança (include usado; tipo de notif intencional) | EXECUTADO (2026-07-18) |
| `33-inbox-detail-area-link.md` | Inbox: converter item salvo perdia o `$area` (payload sem `area_uid`) — resolve por match existente, sem auto-criar | EXECUTADO (2026-07-18) |
| `32-ai-config-inline.md` | Config de IA inline: provider (OpenAI/OpenRouter/custom), chave por-usuário (mascarada no GET), modelo e botão testar sob o toggle | EXECUTADO (2026-07-18) |
| `27-inbox-area-token.md` | Inbox: token `$area` no título espelhando `@pessoa` | EXECUTADO (2026-07-18) |
| `31-branding-validation-and-reset.md` | Marca: validar dimensão, renomear "Enviar", botão restaurar padrão | EXECUTADO (2026-07-18) |
| `26-inbox-person-persist-and-assign.md` | Inbox: `@pessoa` vira chip persistente e seta `assigned_to` ao criar | EXECUTADO (2026-07-18) |
| `30-templates-robustness-and-diagnosis.md` | Modelos falhando: robustez de erro no front + diagnóstico de ambiente | EXECUTADO (2026-07-18) |
| `24-notification-i18n.md` | i18n de notificações agendadas (pt/en) + fix de plural "1 hours" | EXECUTADO (2026-07-18) |
| `25-task-assignee-display.md` | Exibir pessoa atribuída (`assigned_to`) em cards e topo do detalhe (+ include backend) | EXECUTADO (2026-07-18) |
| `29-sidebar-people-add-button.md` | Botão `+` em PESSOAS na sidebar reusando `PersonModal` | EXECUTADO (2026-07-18) |
| `28-inbox-chip-color-and-hint.md` | Chip de tag da inbox em cor única neutra + hint `+Projeto` traduzido | EXECUTADO (2026-07-18) |
| `23-project-templates-local-only.md` | Port da parte local do upstream `2df928b9`: templates de projeto (save-as-template, clone com offset de data + subtasks), sem marketplace | EXECUTADO (2026-07-17) |
| `20-caldav-delete-by-calendar-id-broken-method.md` | `SyncStateRepository.deleteByCalendarId` chama `this.delete`, método que não existe (só `destroy`) — `TypeError` ao deletar calendário CalDAV | EXECUTADO (2026-07-17) |
| `19n-flaky-subtasks-completion.md` | `subtasks-completion.test.js` falhava sob execução paralela (contenção do pool Sequelize) — estabilizado com batching | EXECUTADO (2026-07-17) |
| `21-inbox-mention-cleanup-ascii-regex.md` | `@pessoa` acentuada deixa resto no título ao criar tarefa/nota pelo Inbox (limpeza por token inteiro) | EXECUTADO (2026-07-17) |
| `19l-caldav-delete-missing-method.md` | `SyncStateRepository.deleteByTaskId` não existe — sync de deleção CalDAV lança `TypeError` em runtime (merge/push-phase) | EXECUTADO (2026-07-17) |
| `22-frontend-jest-esm-transform-remark-breaks.md` | Baseline `frontend:test` vermelha: `remark-breaks` (ESM) quebra o Jest, sem mudança de código | EXECUTADO (2026-07-17) |
| `01-r2-cover-cleanup.md` | Capa de projeto órfã no R2 | EXECUTADO (`b707dce`) |
| `02-r2-task-cleanup.md` | Anexos órfãos ao deletar tarefa | EXECUTADO (`fe4e165`) |
| `03-branding-customization.md` | Logo/favicon/nome customizáveis | EXECUTADO (`887e486`) |
| `05a-quick-wins.md` | 5 itens de esforço baixo | EXECUTADO (2026-07-16) |
| `05b-medium-effort.md` | 4 itens de esforço médio | EXECUTADO (2026-07-16) |
| `11-backup-dir-volume.md` | Backup lógico em diretório persistente | EXECUTADO (2026-07-17) |
| `10a-r2-put-and-list.md` | Funções putObjectFromFile e listObjects no r2Service | EXECUTADO (2026-07-17) |
| `10b-db-snapshot-service.md` | createSnapshot(): VACUUM INTO + upload R2 + retenção | EXECUTADO (2026-07-17) |
| `10c-backup-scheduler.md` | Agendar o snapshot (node-cron) + env vars | EXECUTADO (2026-07-17) |
| `10d-backup-restore-docs.md` | Executar um restore de verdade e documentá-lo | EXECUTADO (2026-07-17) |
| `06-docs-update.md` | Atualização integral do `/docs` | EXECUTADO (2026-07-17) |
| `05c-high-effort.md` | HE-1 controller/service em tasks; HE-2 testes de BrandingTab e do guarda de avatar | EXECUTADO (2026-07-17) |
| `13-db-init-guard.md` | Guarda genérica contra `db:init` em banco existente | EXECUTADO (2026-07-17) |
| `14a-mcp-delete-task-seguro.md` | MCP `delete_task` orfana anexos no R2 e apaga histórico de recorrência | EXECUTADO (2026-07-17) |
| `14b-mcp-status-e-datas.md` | MCP: corrigir enum de status (archived≠6), expor `waiting` e filtrar datas de verdade | EXECUTADO (2026-07-17) |
| `14c-mcp-doc-e-registry.md` | Doc do MCP (16→44 tools) e `listMcpTools` derivado do registry | EXECUTADO (2026-07-17) |
| `12-migration-bootstrap-order.md` | Migration fora de ordem faz o bootstrap por migrations gerar schema quebrado em silêncio | EXECUTADO (2026-07-17) |
| `19k-windows-tests-and-fixtures.md` | AB-1/AB-2: baseline de testes (execSync no Windows, mock parsed_people) | EXECUTADO (2026-07-17) |
| `15-backup-prune-por-ambiente.md` | Retenção de snapshot mistura ambientes no prune | EXECUTADO (2026-07-17) |
| `18-skill-tududi-mcp.md` | Manutenção da skill `skills/tududi-mcp` após 14a/14b | EXECUTADO (2026-07-17) |
| `16-views-gtd-status-pessoa.md` | Views por status de tarefa (waiting) e por pessoa — "Aguardando"/"Delegadas" | EXECUTADO (2026-07-17) |
| `17-guia-setup-gtd.md` | Guia de setup GTD (mapeamento TickTick → tududi) | EXECUTADO (2026-07-17, branch `feat/16-views-gtd`) |
| `19c-r2-deep-subtasks-cascade.md` | AL-3: deleteWithOrphaning coleta subtarefas profundas (nível 3+) p/ R2 | EXECUTADO (2026-07-17) |
| `19f-project-sharing-deadlock-fix.md` | AL-7: propaga ctx.tx em collectProjectDescendants (evita SQLITE_BUSY no share) | EXECUTADO (2026-07-17) |
| `19g-backend-pagination-max-limit.md` | AM-4: teto MAX_LIMIT=100 em notifications/inbox/events | EXECUTADO (2026-07-17) |
| `19j-frontend-null-safety-subtasks.md` | AM-8: null-safety em fetchSubtasks/loadSubtasks (evita crash de UI) | EXECUTADO (2026-07-17) |
| `19h-frontend-race-conditions.md` | AM-1/5/7: isMounted/AbortController em ProjectDetails, ViewDetail, ProfileSettings | EXECUTADO (2026-07-17) |
| `19i-frontend-memory-leaks.md` | AM-2/3/6: clearTimeout em usePersistedModal, AreaModal, ProfileSettings | EXECUTADO (2026-07-17) |
| `19a-tasks-transactions.md` | AL-1: create/update de tasks atômicos (sequelize.transaction) propagada a tags/people/subtasks/parent-child | EXECUTADO (2026-07-17) |
| `19e-projects-transactions-and-tags.md` | AL-5: create/update de projects atômicos + erro de tag deixa de ser engolido | EXECUTADO (2026-07-17) |
| `19d-caldav-sync-batching-and-tx.md` | AL-4/AL-6: pull-phase em lotes paralelos + merge-phase create/update transacionais | EXECUTADO (2026-07-17) |
| `19b-backup-restore-mentions.md` | AL-2: backup/restore inclui Person + @mentions e resolve FKs por UID | EXECUTADO (2026-07-17) |
| `19m-backup-tag-name-collision.md` | Restore de backup com colisão em `UNIQUE(user_id, name)` de Tag/Person reaproveita entidade existente | EXECUTADO (2026-07-17) |

## Regras para o agente executor

1. **Antes de começar**: ler `CLAUDE.md` e o plano inteiro. Validar as
   referências `arquivo:linha` do plano contra o código atual — elas envelhecem.
   Se divergirem muito, **atualizar o plano antes de implementar** e dizer isso
   no resumo.
2. **Baseline**: rodar `npm run backend:test` **antes** de qualquer mudança e
   registrar o resultado. Suíte vermelha na baseline = parar e reportar; não é
   você que quebrou.
3. **Escopo**: implementar somente o que o plano descreve. Descoberta nova no
   caminho vira **plano novo**, não scope creep — e nunca item novo em plano já
   EXECUTADO, que o reabriria.
4. **Testes**: toda mudança de comportamento ganha teste seguindo os padrões
   existentes (`backend/tests/integration/`, mock R2 via `aws-sdk-client-mock`,
   ver `task-attachments.test.js`). Suíte completa + lint dos arquivos tocados
   antes do commit.
5. **Commit**: um commit por plano, mensagem convencional
   (`fix:`/`feat:`/`refactor:`/`docs:`), corpo citando o plano (ex.: "Implements
   plans/10a"). Sem emojis, sem `Co-authored-by` (preferências em
   `docs/MEMORY.md`). **Commit sim, push não** — ver Armadilhas.
6. **Branch**: cada plano declara no banner onde trabalhar. Regra geral:
   **correção e documentação vão direto na `main`** (local; push continua
   proibido sem autorização); **feature nova vai em branch própria**
   (`feat/NN-...`), criada a partir da `main`, **sem merge** — o dono valida a
   feature na branch e decide se mantém. Motivo: o Docker builda da `main` do
   GitHub, então a `main` precisa estar sempre em estado pushável; feature
   não validada não pode ficar no caminho de um push urgente de correção.
   Plano sem indicação de branch = `main` direto.
7. **Encerramento**, no mesmo commit:
   - banner no topo do plano, neste formato:
     ```
     > **Status: EXECUTADO** em AAAA-MM-DD — <o que foi feito, 1-2 linhas>.
     ```
   - mover a linha do plano para a tabela "Executados" deste README;
   - se o plano tinha itens e sobrou algum, remover só os itens feitos.
8. **Bloqueio**: só interromper por decisão que exige o dono do repositório
   (credencial, escolha de produto, mudança de API pública). O resto: decidir
   pelo padrão já documentado e registrar o desvio no commit/resumo.

## Contexto permanente

- **O banco é SQLite local**: `/app/db/production.sqlite3` no container, via
  volume `tududi_db`. Em dev, `backend/db/development.sqlite3`. Roda em WAL.
- **Cloudflare R2** guarda anexos, avatares, capas e branding
  (`backend/services/r2Service.js`). **`CLOUDFLARE_ACCOUNT_ID` é usada pelo R2**
  para montar o endpoint.
- **Lição que custou caro**: nunca decidir *"o banco existe?"* por artefato local
  (arquivo, volume, path) se o banco for remoto — nenhum deles descreve um banco
  remoto. Foi essa confusão que zerou a produção duas vezes.
- Env vars Cloudflare: nomes canônicos `CLOUDFLARE_*` (legados `R2_*` aceitos
  como fallback); setup documentado em `.env.example`.
- `docs/MEMORY.md` guarda preferências de PR/commit/testes do repositório.
