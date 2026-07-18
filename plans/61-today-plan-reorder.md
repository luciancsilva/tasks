# 61 — Today Plan manual reorder (`today_order`)

> **Status: PROPOSTO** — Today Plan section sorted por `sortTasksByPriorityDueDateProject` (`TodayPlan.tsx:32-50`), não user-arrangeable. Decisão aprovada: coluna `today_order` server-side.
> **Esforço:** Médio · **Natureza:** julgamento baixo · **Modelo:** médio
> **Branch:** `feat/61-today-reorder` a partir da `main` · **Depende de:** -

## Contexto

Refs:
- `TasksToday.tsx` Today Plan block `:1769-1863`, `TodayPlan` import `:39`.
- `TodayPlan.tsx` `sortedTasks` `:32-50` — split in_progress/rest, sort cada um por `sortTasksByPriorityDueDateProject` (`utils/taskSortUtils.ts:17-20`), concatena.
- `TaskList.tsx` row render `:51-71`.
- `@dnd-kit/sortable ^10.0.0` já dep.

Política: drag opt-in. Se nenhuma task tem `today_order` setado, fallback sort atual. Se user arrasta, atribui `today_order` às tasks envolvidas. Persiste entre dispositivos (self-hosted, 1 user).

## 1. Baseline
```bash
npm run backend:test && npm run frontend:test
```

## 2. Migration
`backend/migrations/20260718000013-add-today-order-to-tasks.js`:
```js
'use strict';
const { SAFE_ADD_COLUMNS } = require('../shared/migration-helpers');
module.exports = {
    async up(queryInterface, Sequelize) {
        await SAFE_ADD_COLUMNS(queryInterface, 'tasks', [
            { column: 'today_order', type: Sequelize.INTEGER, allowNull: true, defaultValue: null },
        ]);
    },
    async down(queryInterface) { try { await queryInterface.removeColumn('tasks', 'today_order'); } catch (e) {} },
};
```

## 3. Model — `backend/models/task.js`
Após `order` (~linha 153):
```js
today_order: { type: DataTypes.INTEGER, allowNull: true, defaultValue: null },
```

## 4. Service — `backend/modules/tasks/service.js`
`create`/`update`: aceitar `today_order` no body, repassar a `taskAttributes`.

## 5. Query-builder — `backend/modules/tasks/queries/query-builders.js`
Adicionar `'today_order'` ao `allowedColumns` de `order_by` (`:378-386`). Sem filtro especial (reorder é client-driven).

## 6. Frontend — TodayPlan.tsx — dnd-kit sortable
`frontend/components/Task/TodayPlan.tsx`:

### 6a. Imports
```tsx
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
```

### 6b. Sort lógica
`sortedTasks` (`:32-50`): se todas as tasks têm `today_order` não-null, ordenar por `today_order` ASC (ignorar sort atual). Se alguma null, fallback sort atual:
```tsx
const sortedTasks = useMemo(() => {
    const allHaveOrder = tasks.length > 0 && tasks.every(t => t.today_order != null);
    if (allHaveOrder) {
        return [...tasks].sort((a, b) => (a.today_order! - b.today_order!));
    }
    // fallback: sort atual (in_progress first, depois sortTasksByPriorityDueDateProject)
    const inProgress = tasks.filter(t => t.status === 1 || t.status === 'in_progress');
    const rest = tasks.filter(t => t.status !== 1 && t.status !== 'in_progress');
    return [...sortTasksByPriorityDueDateProject(inProgress), ...sortTasksByPriorityDueDateProject(rest)];
}, [tasks]);
```

### 6c. DndContext + SortableContext
Envolver `<TaskList>` (`:78-85`):
```tsx
const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

const handleDragEnd = async (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = sortedTasks.findIndex(t => t.uid === active.id);
    const newIndex = sortedTasks.findIndex(t => t.uid === over.id);
    const reordered = arrayMove(sortedTasks, oldIndex, newIndex);
    // persistir novos today_order para todas as reordered
    for (let i = 0; i < reordered.length; i++) {
        if (reordered[i].today_order !== i) {
            await onTaskUpdate({ ...reordered[i], today_order: i });
        }
    }
};

return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={sortedTasks.map(t => t.uid)}>
            {/* TaskList com cada row wrappada em useSortable */}
        </SortableContext>
    </DndContext>
);
```

### 6d. Sortable row
`TaskList.tsx` (`:51-71`): wrap cada row em `SortableTaskRow`:
```tsx
const SortableTaskRow: React.FC<{ task: Task; children: React.ReactNode }> = ({ task, children }) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.uid });
    const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
    return (
        <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="task-item-wrapper">
            {children}
        </div>
    );
};
```
Cuidado: `listeners` no wrapper captura drag mas pode conflitar com clicks nos botões internos do `TaskItem`. Solução: passar `listeners` só a um "drag handle" (ícone ⠿) no `TaskItem`, não ao wrapper inteiro. Adicionar `dragHandleProps` prop ao `TaskItem`.

## 7. Frontend — handler em TasksToday
`handleTaskUpdate` (`:753-996`): já existe. Garantir que repassa `today_order` ao `updateTask(uid, { today_order })`.

## 8. Frontend — Entity TS
`frontend/entities/Task.ts`: `today_order?: number | null`.

## 9. Testes — backend
`backend/tests/integration/tasks-today-order.test.js`:
- `PATCH /task/:uid` com `{ today_order: 5 }` → persiste.
- `GET /tasks?order_by=today_order:asc` → ordena por today_order (null last? Sequelize coloca null primeiro por padrão — tratar com `ORDER BY today_order IS NULL, today_order ASC` se necessário, ou no front).

## 10. Testes — frontend
- `TodayPlan` com todas tasks tendo `today_order` → ordena por today_order (não fallback).
- `TodayPlan` com alguma null → fallback sort atual.
- Drag reorder chama `onTaskUpdate` com novos `today_order` para cada task movida.

## 11. Lint
```bash
cd backend && npx eslint --fix models/task.js modules/tasks/service.js modules/tasks/queries/query-builders.js migrations/20260718000013-add-today-order-to-tasks.js
cd frontend && npx eslint --fix components/Task/TodayPlan.tsx components/Task/TaskList.tsx components/Task/TasksToday.tsx entities/Task.ts
```

## Request / Response shapes
**PATCH /api/task/:uid**: `{ "today_order": 3 }` → response `"today_order": 3`.

## Critério de pronto
- [ ] `today_order` coluna; drag no Today Plan atualiza via PATCH.
- [ ] Se todas tasks têm `today_order`, ordena por ele; senão fallback sort atual.
- [ ] Drag handle não conflita com clicks nos botões do TaskItem.
- [ ] Persiste entre sessões (server-side).
- [ ] Suítes verde; lint limpo.

## Commit
`feat(today): manual reorder of Today Plan with today_order` — "Implements plans/61". Branch `feat/61-today-reorder`, sem merge/push.

## Fora de escopo
- Reorder em outras seções (Overdue/Suggested) — só Today Plan.
- Reorder por dia (today_order é global, não por data).
