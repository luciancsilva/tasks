# 64 — Subtask drag reorder

> **Status: EXECUTADO** em 2026-07-19 — `PATCH /task/:uid/subtasks/reorder`
> (transacional) + dnd-kit em TaskSubtasksSection. **Fix 2026-07-20:** o check de
> acesso no service comparava o retorno de `getAccess` com `'write'`/`'owner'`,
> valores que ele nunca retorna (`'none'|'ro'|'rw'|'admin'`), então lançava
> ForbiddenError em toda chamada — inclusive a do dono. A feature nunca funcionou
> (nenhum teste cobria a rota). Corrigido para `'rw'`/`'admin'` + teste
> `subtasks-reorder.test.js`. Contrato frontend (`{ subtaskIds }`) confere.

> **Status: PROPOSTO** — Subtasks têm `order` (`task.js:153`) mas é display/insertion order, sem drag. `TaskSubtasksSection.tsx` add/edit/delete only. dnd-kit já dep.
> **Esforço:** Médio · **Natureza:** julgamento baixo · **Modelo:** médio
> **Branch:** `feat/64-subtask-drag` a partir da `main` · **Depende de:** -

## Contexto

Refs:
- `TaskSubtasksSection.tsx` (em `frontend/components/Task/TaskDetails/`) — add/edit/delete, sem reorder.
- `operations/subtasks.js` `:172` `taskRepository.bulkUpdate` para reorder (já existe helper de bulk update de order).
- `@dnd-kit/sortable ^10.0.0` já dep.
- `task.js:153` `order` INTEGER null.

Subtasks são tasks com `parent_task_id` set. Reorder atualiza `order` via PATCH bulk.

## 1. Baseline
```bash
npm run backend:test && npm run frontend:test
```

## 2. Backend — bulk reorder endpoint
`backend/modules/tasks/routes.js` após `:31` (`GET /task/:uid/subtasks`):
```js
router.patch('/task/:uid/subtasks/reorder', requireTaskWriteAccess, tasksController.reorderSubtasks);
```

## 3. Controller — `backend/modules/tasks/controller.js`
```js
async reorderSubtasks(req, res, next) {
    try {
        const userId = requireUserId(req);
        const { uid } = req.params;
        const { orderedSubtaskUids } = req.body; // array de uids na nova ordem
        const result = await tasksService.reorderSubtasks(userId, uid, orderedSubtaskUids);
        res.json(result);
    } catch (err) { next(err); }
}
```

## 4. Service — `backend/modules/tasks/service.js`
```js
async reorderSubtasks(userId, parentUid, orderedUids) {
    if (!Array.isArray(orderedUids)) throw new ValidationError('orderedSubtaskUids required');
    const parent = await taskRepository.findByUid(parentUid);
    if (!parent || parent.user_id !== userId) throw new NotFoundError('Task not found');
    await sequelize.transaction(async (t) => {
        for (let i = 0; i < orderedUids.length; i++) {
            const sub = await taskRepository.findByUid(orderedUids[i]);
            if (!sub || sub.parent_task_id !== parent.id) continue;
            await sub.update({ order: i }, { transaction: t });
        }
    });
    return { reordered: orderedUids.length };
}
```

## 5. Frontend — TaskSubtasksSection — dnd-kit
`frontend/components/Task/TaskDetails/TaskSubtasksSection.tsx`:

### 5a. Imports
```tsx
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
```

### 5b. Sortable subtask row
```tsx
const SortableSubtask: React.FC<{ subtask: Task; onComplete; onEdit; onDelete }> = ({ subtask, ...handlers }) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: subtask.uid });
    const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
    return (
        <div ref={setNodeRef} style={style} className="flex items-center gap-2 p-2 border rounded">
            <button {...listeners} {...attributes} className="cursor-grab text-gray-400">⠿</button>
            {/* checkbox complete + name + edit/delete existentes */}
        </div>
    );
};
```
Drag handle `⠿` separado (não conflita com checkbox/edit/delete).

### 5c. DndContext
```tsx
const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

const handleDragEnd = async (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = subtasks.findIndex(s => s.uid === active.id);
    const newIndex = subtasks.findIndex(s => s.uid === over.id);
    const reordered = arrayMove(subtasks, oldIndex, newIndex);
    await reorderSubtasks(parentUid, reordered.map(s => s.uid));
    // refresh subtasks from store
};

<DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
    <SortableContext items={subtasks.map(s => s.uid)}>
        {subtasks.map(s => <SortableSubtask key={s.uid} subtask={s} ... />)}
    </SortableContext>
</DndContext>
```

## 6. Frontend — service
`frontend/utils/tasksService.ts`:
```ts
export async function reorderSubtasks(parentUid: string, orderedUids: string[]) {
    const res = await fetch(`/api/task/${parentUid}/subtasks/reorder`, { method: 'PATCH', credentials: 'include',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orderedSubtaskUids: orderedUids }) });
    if (!res.ok) throw new Error('Reorder failed');
    return res.json();
}
```

## 7. Testes — backend
`backend/tests/integration/tasks-subtasks-reorder.test.js`:
- `PATCH /task/:uid/subtasks/reorder` com `orderedSubtaskUids: [c,a,b]` → tasks `order` = 0,1,2 respectivamente.
- Subtask de outro parent no array → ignorada (não reordenada).
- Parent inexistente → 404.

## 8. Testes — frontend
- `TaskSubtasksSection` com drag: arrastar subtask B antes de A chama `reorderSubtasks` com nova ordem.
- Drag handle `⠿` não dispara checkbox/edit/delete.

## 9. Lint
```bash
cd backend && npx eslint --fix modules/tasks/routes.js modules/tasks/controller.js modules/tasks/service.js
cd frontend && npx eslint --fix components/Task/TaskDetails/TaskSubtasksSection.tsx utils/tasksService.ts
```

## Request / Response shapes
**PATCH /api/task/:uid/subtasks/reorder**: `{ "orderedSubtaskUids": ["uidC","uidA","uidB"] }` → `{ "reordered": 3 }`.

## Critério de pronto
- [ ] Drag reorder subtasks atualiza `order` via PATCH bulk atômico.
- [ ] Drag handle separado não conflita com checkbox/edit/delete.
- [ ] Suítes verde; lint limpo.

## Commit
`feat(subtasks): drag-to-reorder with dnd-kit` — "Implements plans/64". Branch `feat/64-subtask-drag`, sem merge/push.

## Fora de escopo
- Drag subtask entre parents (move parent_task_id) — plano futuro.
- Multi-level subtask drag (subtasks de subtasks).
