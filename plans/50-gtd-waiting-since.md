# 50 — Waiting-For nativo + `waiting_since`

> **Status: PROPOSTO** — `Task.status=waiting` (4) já existe (`backend/models/task.js:323,384`) e o `case 'waiting'` em `query-builders.js:302-304` filtra por ele. View `extras.task_status='waiting'` suportado (plano 16). **Falta:** timestamp `waiting_since` (quando entrou em waiting) → sem ele, follow-up overdue é impossível; sem sidebar entry nativa; sem badge de follow-up.
> **Esforço:** Médio · **Natureza:** julgamento baixo · **Modelo:** médio
> **Branch:** `feat/50-gtd-waiting-since` a partir da `main` · **Depende de:** -

## Contexto

GTD "Waiting-For" = tarefas delegadas/bloqueadas em terceiro, revisadas semanalmente para cobrar follow-up. Hoje: status `waiting` + View pinada (`docs/17-gtd-setup.md:22`). Sem `waiting_since` não há como saber "esperando há 3 semanas, cobre".

Política: `waiting_since` setado automaticamente quando `status` transiciona **para** `waiting`; limpo quando sai de `waiting`. Override manual permitido.

## 1. Baseline
```bash
npm run backend:test && npm run frontend:test
```

## 2. Migration
Crie `backend/migrations/20260718000002-add-waiting-since-to-tasks.js`:
```js
'use strict';
const { SAFE_ADD_COLUMNS } = require('../shared/migration-helpers');

module.exports = {
    async up(queryInterface, Sequelize) {
        await SAFE_ADD_COLUMNS(queryInterface, 'tasks', [
            { column: 'waiting_since', type: Sequelize.DATE, allowNull: true, defaultValue: null },
        ]);
    },
    async down(queryInterface) {
        try { await queryInterface.removeColumn('tasks', 'waiting_since'); } catch (e) {}
    },
};
```
Sem backfill (tasks em waiting hoje ficam `waiting_since=null`; user pode setar manualmente).

## 3. Model — `backend/models/task.js`
Após `completed_at` (~linha 158):
```js
waiting_since: {
    type: DataTypes.DATE,
    allowNull: true,
    defaultValue: null,
},
```

## 4. Service — auto-set/clear — `backend/modules/tasks/service.js`

### 4a. `update` (`:420`)
Antes de montar `taskAttributes` (na transação `:549-583`), detectar transição de status. Após carregar `task` (existing) e antes de `task.update`:
```js
const prevStatus = task.status;
const nextStatus = body.status !== undefined ? Task.getStatusValue(body.status) : prevStatus;
if (nextStatus === Task.STATUS.WAITING && prevStatus !== Task.STATUS.WAITING) {
    if (body.waiting_since === undefined) {
        taskAttributes.waiting_since = new Date(); // UTC; front formata por fuso
    } else {
        taskAttributes.waiting_since = body.waiting_since; // override manual
    }
} else if (nextStatus !== Task.STATUS.WAITING && prevStatus === Task.STATUS.WAITING) {
    taskAttributes.waiting_since = null; // saiu de waiting
}
// se body.waiting_since vier explícito em qualquer caso, respeitar:
if (body.waiting_since !== undefined && nextStatus === Task.STATUS.WAITING) {
    taskAttributes.waiting_since = body.waiting_since;
}
```
`Task.getStatusValue` em `task.js:378-389`.

### 4b. `create` (`:319`)
Após montar `taskAttributes`, se `status=waiting` no payload (via `Task.getStatusValue`):
```js
if (taskAttributes.status === Task.STATUS.WAITING && !taskAttributes.waiting_since) {
    taskAttributes.waiting_since = new Date();
}
```

### 4c. Serializer
Garanta `waiting_since` no response (spread `task.toJSON()` já inclui após model ganhar campo).

## 5. Query-builder — follow-up filter
`backend/modules/tasks/queries/query-builders.js`, estender `case 'waiting'` (`:302-304`):
```js
case 'waiting':
    whereClause.status = Task.STATUS.WAITING;
    if (params.waiting_overdue_days !== undefined) {
        const days = parseInt(params.waiting_overdue_days, 10);
        if (!Number.isFinite(days) || days < 0) throw new Error('Invalid waiting_overdue_days');
        const cutoff = new Date(Date.now() - days * 86400000);
        whereClause.waiting_since = { [Op.lt]: cutoff };
    }
    break;
```

## 6. Rotas
`GET /tasks?type=waiting&waiting_overdue_days=7` já funciona via `routes.js:19`. Sem rota nova.

## 7. Frontend — Sidebar — `SidebarNav.tsx`
Adicione após Someday (plano 49) ou após Upcoming (`:53-57`):
```tsx
{
    path: '/tasks?type=waiting',
    title: t('sidebar.waiting', 'Waiting'),
    icon: <ClockIcon className="h-5 w-5" />,
    query: 'type=waiting',
},
```
`ClockIcon` já importado (`:8`).

## 8. Frontend — Waiting list page — `Tasks.tsx`
Branch `?type=waiting`: título "Waiting For". Renderizar duas sub-seções:
1. **Follow-up overdue** — busca `?type=waiting&waiting_overdue_days=7` (vermelho/badge).
2. **All waiting** — `?type=waiting`.
Reusar `GroupedTaskList`. Lógica: fetch duplo OU fetch único + split client-side por `waiting_since` < hoje-7d. Simpler: fetch `?type=waiting` único, dividir client-side:
```tsx
const followUpOverdue = tasks.filter(t => t.waiting_since && daysSince(t.waiting_since) >= 7);
const rest = tasks.filter(t => !t.waiting_since || daysSince(t.waiting_since) < 7);
```

## 9. Frontend — TaskDetails card
Crie `TaskWaitingSinceCard.tsx` (template `TaskAssignedToCard.tsx`). Só visível quando `task.status === 'waiting'` (ou `4`):
```tsx
interface TaskWaitingSinceCardProps {
    task: Task;
    onAdjust: (date: Date | null) => Promise<void>;
}
```
UI: label "Waiting since" + `<input type="date">` + botão "Clear". Handler em `TaskDetails.tsx`:
```tsx
const handleAdjustWaitingSince = async (date: Date | null) => {
    if (!task?.uid) return;
    taskModifiedRef.current = true;
    await updateTask(task.uid, { waiting_since: date ? date.toISOString() : null });
    const updatedTask = await fetchTaskByUid(uid!);
    tasksStore.updateTaskInStore(updatedTask);
};
```
Renderize após `TaskSomedayCard` (plano 49) ou após `TaskAssignedToCard` (`:1354`).

## 10. Frontend — Entity TS
`frontend/entities/Task.ts`: adicione `waiting_since?: string | null`.

## 11. Testes — backend
`backend/tests/integration/tasks-waiting-since.test.js`:
- task `not_started` → `PATCH status=waiting` → `waiting_since` setado ≈ agora (±1min).
- task `waiting` → `PATCH status=in_progress` → `waiting_since=null`.
- `PATCH status=waiting` com `waiting_since="2026-01-01"` → respeita override.
- `GET /tasks?type=waiting&waiting_overdue_days=7` retorna só waiting com `waiting_since < hoje-7`.
- create com `status=waiting` → `waiting_since` setado.
- create com `status=not_started` → `waiting_since=null`.

## 12. Lint
```bash
cd backend && npx eslint --fix models/task.js modules/tasks/service.js modules/tasks/queries/query-builders.js modules/tasks/core/serializers.js migrations/20260718000002-add-waiting-since-to-tasks.js
cd frontend && npx eslint --fix components/Task/TaskDetails/TaskWaitingSinceCard.tsx components/Task/TaskDetails/index.ts components/Task/TaskDetails.tsx components/Sidebar/SidebarNav.tsx components/Task/Tasks.tsx entities/Task.ts
```

## Request / Response shapes
**PATCH /api/task/:uid** com transição para waiting:
```json
{ "status": "waiting" }
```
Response inclui `"waiting_since": "2026-07-18T14:30:00.000Z"`.
**GET /api/tasks?type=waiting&waiting_overdue_days=7** — só tasks com `waiting_since` anterior a hoje-7d.

## Critério de pronto
- [ ] `waiting_since` auto-set em transição→waiting; auto-clear em saída.
- [ ] Override manual funciona.
- [ ] `GET /tasks?type=waiting&waiting_overdue_days=N` filtra follow-up overdue.
- [ ] Sidebar entry "Waiting"; lista mostra follow-up overdue em destaque.
- [ ] TaskDetails mostra/ajusta waiting_since (só em status=waiting).
- [ ] Suítes verde; lint limpo.

## Commit
`feat(tasks): native Waiting-For with waiting_since and follow-up filter` — "Implements plans/50". Branch `feat/50-gtd-waiting-since`, sem merge/push.

## Fora de escopo
- Notificação automática de waiting overdue (plano 55 ou cron futuro).
- Backfill automático de `waiting_since` para tasks waiting pré-migration.
