# 63 — Bulk ops tasks (status / priority+due / delete+complete / energy+time+assigned)

> **Status: PROPOSTO** — Sem bulk ops. Decisão aprovada: checkbox por row + floating toolbar. Operações: status, priority+due_date, delete+complete, energy+time+assigned.
> **Esforço:** Médio · **Natureza:** julgamento baixo · **Modelo:** médio
> **Branch:** `feat/63-bulk-ops-tasks` a partir da `main` · **Depende de:** 51, 52 (energy/time)

## Contexto

Refs:
- `TaskList.tsx` `:6-19` (props), `:49-71` (container + map), sem checkbox col.
- `GroupedTaskList.tsx` `:13-26` (props), 3 modos de render (day/project/recurring).
- `tasks/service.js` transaction pattern `:385-397` (create), `:549-583` (update).
- `repository.js` `bulkUpdate` `:81`.
- `routes.js` `:19-33` — `POST /tasks/bulk` insere antes de `:uid` routes.

Operações aprovadas (subconjunto): **status**, **priority + due_date**, **delete + complete**, **energy + time_estimate + assigned_to**. NÃO incluído: move project/area, add/remove tags (user não selecionou).

## 1. Baseline
```bash
npm run backend:test && npm run frontend:test
```

## 2. Backend — endpoint bulk
`backend/modules/tasks/routes.js` após `:21` (`GET /tasks/metrics`), antes `:23` (`POST /task`):
```js
router.post('/tasks/bulk', tasksController.bulkUpdate);
router.post('/tasks/bulk-delete', tasksController.bulkDelete);
```

## 3. Controller — `backend/modules/tasks/controller.js`
Adicione ao object literal (`:15-167`):
```js
async bulkUpdate(req, res, next) {
    try {
        const userId = requireUserId(req);
        const tz = req.currentUser?.timezone || 'UTC';
        const result = await tasksService.bulkUpdate(userId, tz, req.body);
        res.json({ updated: result.updated, failed: result.failed });
    } catch (err) { next(err); }
}

async bulkDelete(req, res, next) {
    try {
        const userId = requireUserId(req);
        const result = await tasksService.bulkDelete(userId, req.body);
        res.json({ deleted: result.deleted, failed: result.failed });
    } catch (err) { next(err); }
}
```

## 4. Service — `backend/modules/tasks/service.js`
```js
async bulkUpdate(userId, tz, body) {
    const { uids, fields } = body; // fields: { status?, priority?, due_date?, energy?, time_estimate?, assigned_to? }
    if (!Array.isArray(uids) || uids.length === 0) throw new ValidationError('uids required');
    if (!fields || typeof fields !== 'object') throw new ValidationError('fields required');
    const allowed = ['status', 'priority', 'due_date', 'energy', 'time_estimate', 'assigned_to'];
    const updates = {};
    for (const k of allowed) if (fields[k] !== undefined) updates[k] = fields[k];
    if (Object.keys(updates).length === 0) throw new ValidationError('no valid fields');
    if (updates.status !== undefined) updates.status = Task.getStatusValue(updates.status);
    if (updates.priority !== undefined) updates.priority = Task.getPriorityValue(updates.priority);
    if (updates.energy !== undefined) updates.energy = Task.getEnergyValue(updates.energy);

    const updated = []; const failed = [];
    await sequelize.transaction(async (t) => {
        for (const uid of uids) {
            try {
                const task = await taskRepository.findByUid(uid);
                if (!task || task.user_id !== userId) { failed.push({ uid, reason: 'not found' }); continue; }
                await task.update(updates, { transaction: t });
                updated.push(uid);
            } catch (e) { failed.push({ uid, reason: e.message }); }
        }
    });
    return { updated, failed };
}

async bulkDelete(userId, body) {
    const { uids } = body;
    if (!Array.isArray(uids) || uids.length === 0) throw new ValidationError('uids required');
    const deleted = []; const failed = [];
    await sequelize.transaction(async (t) => {
        for (const uid of uids) {
            try {
                const task = await taskRepository.findByUid(uid);
                if (!task || task.user_id !== userId) { failed.push({ uid, reason: 'not found' }); continue; }
                await this.delete(uid); // reusa delete existente (:641) — atenção: delete tem sua própria tx; chamar fora da tx outer OU adaptar
                deleted.push(uid);
            } catch (e) { failed.push({ uid, reason: e.message }); }
        }
    });
    return { deleted, failed };
}
```
Nota: `this.delete(uid)` (`:641`) já tem transaction própria. Para atomicidade bulk, refatorar `delete` para aceitar `{ transaction }` opcional, OU chamar sem tx outer (bulk delete não-atômico por task, mas reporta failures). Recomendado: refatorar `delete` para aceitar tx opcional (padrão fork: helpers recebem `{ transaction }`).

## 5. Frontend — selection state
`TaskList.tsx` (`:6-19` props): adicione `selectable?: boolean`, `selectedUids?: Set<string>`, `onToggleSelect?: (uid: string) => void`.

No render (`:51-71`), se `selectable`, wrap row com checkbox:
```tsx
<div className="task-item-wrapper flex items-center gap-2">
    {selectable && (
        <input type="checkbox" checked={selectedUids.has(task.uid)} onChange={() => onToggleSelect?.(task.uid)} />
    )}
    <TaskItem ... />
</div>
```
`GroupedTaskList.tsx`: mesmo padrão em cada modo de render.

## 6. Frontend — toolbar
Novo `frontend/components/Task/BulkToolbar.tsx`:
```tsx
interface BulkToolbarProps {
    selectedUids: Set<string>;
    onClear: () => void;
    onBulkUpdate: (fields: Partial<Task>) => Promise<void>;
    onBulkDelete: () => Promise<void>;
    onBulkComplete: () => Promise<void>;
}
```
Renderiza floating bottom: count + dropdowns (status, priority, energy) + date picker (due_date) + assigned select + buttons Complete/Delete. Confirm dialog em Delete.

## 7. Frontend — Tasks page
`Tasks.tsx` + `TasksToday.tsx`: adicionar selection mode toggle (botão "Select" no header). State `selectedUids: Set<string>`. Quando >0 selecionadas, renderizar `<BulkToolbar>` fixo bottom. Handlers chamam `tasksService.bulkUpdate`/`bulkDelete`.

## 8. Frontend — service
`frontend/utils/tasksService.ts`:
```ts
export async function bulkUpdateTasks(uids: string[], fields: Partial<Task>) {
    const res = await fetch('/api/tasks/bulk', { method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ uids, fields }) });
    if (!res.ok) throw new Error('Bulk update failed');
    return res.json();
}
export async function bulkDeleteTasks(uids: string[]) {
    const res = await fetch('/api/tasks/bulk-delete', { method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ uids }) });
    if (!res.ok) throw new Error('Bulk delete failed');
    return res.json();
}
```

## 9. Testes — backend
`backend/tests/integration/tasks-bulk.test.js`:
- `POST /tasks/bulk` com `{ uids: [a,b], fields: { status: 'waiting' } }` → ambas atualizadas; response `{ updated: [a,b], failed: [] }`.
- `{ uids, fields: { priority: 'high', due_date: '2026-07-25' } }` → priority+due applied.
- `{ uids, fields: { energy: 'low', time_estimate: 15, assigned_to: 'person-uid' } }` → applied.
- uid inexistente → `{ failed: [{ uid, reason: 'not found' }] }`.
- `fields: {}` → 400.
- `POST /tasks/bulk-delete` → tasks deletadas; R2 anexos limpos (reuso `delete`).

## 10. Lint
```bash
cd backend && npx eslint --fix modules/tasks/routes.js modules/tasks/controller.js modules/tasks/service.js
cd frontend && npx eslint --fix components/Task/TaskList.tsx components/Task/GroupedTaskList.tsx components/Task/BulkToolbar.tsx components/Task/Tasks.tsx components/Task/TasksToday.tsx utils/tasksService.ts
```

## Request / Response shapes
**POST /api/tasks/bulk**: `{ "uids": ["abc","def"], "fields": { "status": "waiting", "priority": "high", "due_date": "2026-07-25", "energy": "low", "time_estimate": 15, "assigned_to": "person-uid" } }` → `{ "updated": ["abc","def"], "failed": [] }`.
**POST /api/tasks/bulk-delete**: `{ "uids": ["abc"] }` → `{ "deleted": ["abc"], "failed": [] }`.

## Critério de pronto
- [ ] `POST /tasks/bulk` atômico (transaction); aceita status/priority/due_date/energy/time_estimate/assigned_to.
- [ ] `POST /tasks/bulk-delete` atômico.
- [ ] TaskList/GroupedTaskList com checkbox col em selection mode.
- [ ] BulkToolbar flutuante com actions; Delete pede confirm.
- [ ] Suítes verde; lint limpo.

## Commit
`feat(tasks): bulk operations with selection toolbar` — "Implements plans/63". Branch `feat/63-bulk-ops-tasks`, sem merge/push.

## Fora de escopo
- Bulk move project/area, bulk add/remove tags (não aprovado).
- Bulk em Inbox (plano 69).
