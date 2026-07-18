# 52 — Campo `time_estimate` em Task (minutos)

> **Status: EXECUTADO** em 2026-07-18 — campo `time_estimate` (INTEGER 1-1440) em tasks + `time_max` em views; filtros `time_max`/`time_min` no query-builder (throw `ValidationError`→400) + `order_by=time_estimate`; search + views service/validation; MCP create/update/list; TaskTimeEstimateCard (input+presets); slots "Time available" em SearchMenu/SaveViewModal. Teste `tasks-time-estimate.test.js` (13). Desvio: plano citava `View.ts` entity (não existe — shape inline) e helper `SAFE_ADD_COLUMNS` (real é `safeAddColumns` de `utils/migration-utils`).
> **Status original: PROPOSTO** — GTD "Engajar" filtra por tempo disponível ("tenho 15 min"). Hoje 100% tag-convention (`d-rapido`/`d-medio`/`d-demorado`, `docs/17-gtd-setup.md:31`). Sem campo nativo, sem filtro "≤N min", sem UI. Pomodoro timer existe (`Shared/PomodoroTimer.tsx`) mas não binda task nem usa estimate.
> **Esforço:** Baixo · **Natureza:** julgamento baixo · **Modelo:** baixo
> **Branch:** `feat/52-task-time-estimate` a partir da `main` · **Depende de:** -

## Contexto

GTD time-available: usuário com bloco de 15/30/60 min seleciona tasks que cabem. Campo nativo `time_estimate` (minutos, INTEGER) permite filtro `time_max=N` (≤N min), sort. Distinto de `priority`/`energy`. `TaskEvent` computa duração real post-hoc (`task_event.js:254-288`) — estimate é前瞻, actual é histórico.

## 1. Baseline
```bash
npm run backend:test && npm run frontend:test
```

## 2. Migration — tasks
`backend/migrations/20260718000005-add-time-estimate-to-tasks.js`:
```js
'use strict';
const { SAFE_ADD_COLUMNS } = require('../shared/migration-helpers');
module.exports = {
    async up(queryInterface, Sequelize) {
        await SAFE_ADD_COLUMNS(queryInterface, 'tasks', [
            { column: 'time_estimate', type: Sequelize.INTEGER, allowNull: true, defaultValue: null,
              validate: { min: 1, max: 1440 } },
        ]);
    },
    async down(queryInterface) { try { await queryInterface.removeColumn('tasks', 'time_estimate'); } catch (e) {} },
};
```

## 3. Migration — views
`backend/migrations/20260718000006-add-time-max-to-views.js`:
```js
'use strict';
const { SAFE_ADD_COLUMNS } = require('../shared/migration-helpers');
module.exports = {
    async up(queryInterface, Sequelize) {
        await SAFE_ADD_COLUMNS(queryInterface, 'views', [
            { column: 'time_max', type: Sequelize.INTEGER, allowNull: true, defaultValue: null },
        ]);
    },
    async down(queryInterface) { try { await queryInterface.removeColumn('views', 'time_max'); } catch (e) {} },
};
```

## 4. Model — `backend/models/task.js`
Após `energy` (plano 51) ou após `priority` (`:35`):
```js
time_estimate: {
    type: DataTypes.INTEGER,
    allowNull: true,
    defaultValue: null,
    validate: { min: 1, max: 1440 },
},
```

## 5. Model — `backend/models/view.js`
Após `energy` (plano 51) ou após `priority` (`:46`):
```js
time_max: { type: DataTypes.INTEGER, allowNull: true, defaultValue: null },
```

## 6. Query-builder — `backend/modules/tasks/queries/query-builders.js`
Após bloco `if (params.energy)` (plano 51) ou após `if (params.priority)` (`:365-367`):
```js
if (params.time_max !== undefined) {
    const max = Number(params.time_max);
    if (!Number.isFinite(max) || max < 1) throw new Error('Invalid time_max');
    whereClause.time_estimate = { [Op.and]: [{ [Op.ne]: null }, { [Op.lte]: max }] };
}
if (params.time_min !== undefined) {
    const min = Number(params.time_min);
    if (!Number.isFinite(min) || min < 0) throw new Error('Invalid time_min');
    whereClause.time_estimate = {
        ...(whereClause.time_estimate || {}),
        [Op.gte]: min,
    };
}
```
Adicione `'time_estimate'` ao `allowedColumns` de `order_by` (`:378-386`).

## 7. Service — `backend/modules/tasks/service.js`
`create`/`update`: destruture `time_estimate` e repasse a `taskAttributes` via `buildTaskAttributes`.

## 8. Views + search
### 8a. `backend/modules/views/service.js`
`create`/`update`: destruture `time_max`, persista.
### 8b. `backend/modules/views/validation.js`
```js
function validateTimeMax(timeMax) {
    if (timeMax === null || timeMax === undefined) return null;
    const n = Number(timeMax);
    if (!Number.isFinite(n) || n < 1) throw new ValidationError('Invalid time_max');
    return n;
}
```
### 8c. `backend/modules/search/validation.js` — `parseSearchParams` (`:6-55`)
Adicione `time_max`, `time_min` aos params.
### 8d. `backend/modules/search/service.js`
Após aplicação de `energy`, adicione:
```js
if (time_max !== undefined) {
    taskWhere.time_estimate = { [Op.and]: [{ [Op.ne]: null }, { [Op.lte]: Number(time_max) }] };
}
```

## 9. Frontend — TaskDetails card
Crie `frontend/components/Task/TaskDetails/TaskTimeEstimateCard.tsx`:
```tsx
interface TaskTimeEstimateCardProps {
    task: Task;
    onChange: (minutes: number | null) => Promise<void>;
}
```
UI: input numérico (min) + presets rápidos (5/15/30/60/120 — botões). Handler em `TaskDetails.tsx`:
```tsx
const handleChangeTimeEstimate = async (minutes) => {
    if (!task?.uid) return;
    taskModifiedRef.current = true;
    await updateTask(task.uid, { time_estimate: minutes });
    const updatedTask = await fetchTaskByUid(uid!);
    tasksStore.updateTaskInStore(updatedTask);
};
```
Renderize após `TaskEnergyCard` (plano 51).

## 10. Frontend — UniversalSearch — `SearchMenu.tsx`
Adicione `timeOptions`:
```tsx
const timeOptions = [
    { value: '15', label: t('search.time15', '≤ 15 min') },
    { value: '30', label: t('search.time30', '≤ 30 min') },
    { value: '60', label: t('search.time60', '≤ 1h') },
    { value: '120', label: t('search.time120', '≤ 2h') },
];
```
State `selectedTimeMax`, toggle handler, render badges (espelhe Priority `:514-536`). Repasse a `<SearchResults>` e ao save-view body (`:176-185`) como `time_max`.

## 11. Frontend — SaveViewModal
Adicione prop `time_max?: number | null`. Renderize select de presets. Adicione ao POST body (`:74-81`).

## 12. Frontend — Entity TS
`frontend/entities/Task.ts`: `time_estimate?: number | null`.
`frontend/entities/View.ts`: `time_max?: number | null`.

## 13. MCP — `backend/modules/mcp/tools/taskTools.js`
`create_task`/`update_task`: adicione `time_estimate` (int, 1-1440). `list_tasks`: adicione `time_max` ao filtro.

## 14. Testes — backend
`backend/tests/integration/tasks-time-estimate.test.js`:
- create/update com `time_estimate=30` → round-trip.
- `GET /tasks?time_max=15` → só `time_estimate ≤ 15` (e não-null).
- `GET /tasks?time_min=60&time_max=120` → range.
- `GET /tasks?order_by=time_estimate:asc` → ordena.
- View com `time_max=30` → search aplica.
- `time_estimate=null` em legada → não quebra; não aparece em `?time_max=15`.
- `time_max=0` ou negativo → erro.

## 15. Lint
```bash
cd backend && npx eslint --fix models/task.js models/view.js modules/tasks/queries/query-builders.js modules/tasks/service.js modules/tasks/core/builders.js modules/views/service.js modules/views/validation.js modules/search/service.js modules/search/validation.js modules/mcp/tools/taskTools.js migrations/20260718000005-add-time-estimate-to-tasks.js migrations/20260718000006-add-time-max-to-views.js
cd frontend && npx eslint --fix components/Task/TaskDetails/TaskTimeEstimateCard.tsx components/Task/TaskDetails/index.ts components/Task/TaskDetails.tsx components/UniversalSearch/SearchMenu.tsx components/UniversalSearch/SaveViewModal.tsx entities/Task.ts
```

## Request / Response shapes
**POST /api/task**: `{ "name": "Call standup", "time_estimate": 15 }` → response `"time_estimate": 15`.
**GET /api/tasks?time_max=30**: tasks com `time_estimate ≤ 30` e não-null.
**POST /api/views**: `{ "name": "Quick wins", "time_max": 15 }`.

## Critério de pronto
- [ ] `time_estimate` em tasks; `time_max` em views.
- [ ] Filtros `time_max`/`time_min` em `/tasks`; View `time_max` funciona.
- [ ] `order_by=time_estimate` ordena.
- [ ] TaskDetails tem card Time Estimate com presets.
- [ ] UniversalSearch tem slot "Time ≤"; SaveViewModal tem select.
- [ ] Tasks legadas (null) não quebram.
- [ ] Suítes verde; lint limpo.

## Commit
`feat(tasks): native time_estimate field with time-available filter` — "Implements plans/52". Branch `feat/52-task-time-estimate`, sem merge/push.

## Fora de escopo
- Bind Pomodoro timer ↔ task estimate (plano 59 — focus mode).
- Comparação estimate vs actual (`TaskEvent` duration) — plano futuro de métrica.
- AI auto-estimativa no Inbox.
