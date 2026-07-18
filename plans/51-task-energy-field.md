# 51 — Campo `energy` em Task (high/med/low)

> **Status: EXECUTADO** em 2026-07-18 — Campo `energy` (INTEGER 0-2) em tasks + STRING em views; `Task.ENERGY`/`getEnergyValue`/`getEnergyName`; filtro `/tasks?energy=` (nome ou numérico) + `order_by=energy`; View `energy` com `validateEnergy` (400 em inválido); SearchMenu/SearchResults/SearchService/SaveViewModal slot de energy; `TaskEnergyCard` no TaskDetails; MCP `create_task`/`update_task`/`list_tasks` expõem energy; builders aceitam nome OU numérico (low→0, fallback null em string inválida).
> **Esforço:** Baixo · **Natureza:** julgamento baixo · **Modelo:** baixo
> **Branch:** `feat/51-task-energy-field` a partir da `main` · **Depende de:** -

## Contexto

GTD energy levels: high (criativo pesado), med (normal), low (rotina). Usuário escolhe "tenho 15 min e energia baixa → mostra low-energy tasks". Campo nativo permite filtro server-side + sort. Distinto de `priority` (`task.js:310-316`, 0-2) — eixo independente.

## 1. Baseline
```bash
npm run backend:test && npm run frontend:test
```

## 2. Migration — tasks
`backend/migrations/20260718000003-add-energy-to-tasks.js`:
```js
'use strict';
const { SAFE_ADD_COLUMNS } = require('../shared/migration-helpers');
module.exports = {
    async up(queryInterface, Sequelize) {
        await SAFE_ADD_COLUMNS(queryInterface, 'tasks', [
            { column: 'energy', type: Sequelize.INTEGER, allowNull: true, defaultValue: null,
              validate: { isIn: [[0, 1, 2]] } },
        ]);
    },
    async down(queryInterface) { try { await queryInterface.removeColumn('tasks', 'energy'); } catch (e) {} },
};
```

## 3. Migration — views
`backend/migrations/20260718000004-add-energy-to-views.js`:
```js
'use strict';
const { SAFE_ADD_COLUMNS } = require('../shared/migration-helpers');
module.exports = {
    async up(queryInterface, Sequelize) {
        await SAFE_ADD_COLUMNS(queryInterface, 'views', [
            { column: 'energy', type: Sequelize.STRING, allowNull: true, defaultValue: null },
        ]);
    },
    async down(queryInterface) { try { await queryInterface.removeColumn('views', 'energy'); } catch (e) {} },
};
```

## 4. Model — `backend/models/task.js`
Após `priority` (~linha 35):
```js
energy: {
    type: DataTypes.INTEGER,
    allowNull: true,
    defaultValue: null,
    validate: { isIn: [[0, 1, 2]] },
},
```
Constantes (após `Task.PRIORITY` `:310-316`):
```js
Task.ENERGY = { LOW: 0, MEDIUM: 1, HIGH: 2 };
Task.getEnergyName = (v) => ['low', 'medium', 'high'][v] ?? null;
Task.getEnergyValue = (n) => ({ low: 0, medium: 1, high: 2 }[n] ?? null);
```

## 5. Model — `backend/models/view.js`
Após `priority` (`:46`):
```js
energy: { type: DataTypes.STRING, allowNull: true, defaultValue: null },
```

## 6. Query-builder — `backend/modules/tasks/queries/query-builders.js`
Após bloco `if (params.priority)` (`:365-367`):
```js
if (params.energy) {
    const ev = Task.getEnergyValue(params.energy);
    if (ev !== null) whereClause.energy = ev;
}
```
Adicione `'energy'` ao array `allowedColumns` de `order_by` (`:378-386`).

## 7. Service — `backend/modules/tasks/service.js`
`create` (`:319`): adicione `energy` ao destructuring (`:320-332`) e a `taskAttributes` via `buildTaskAttributes`.
`update` (`:420`): adicione `energy` ao destructuring; se `!== undefined`, adicione a `taskAttributes`.

## 8. Views service + validation + search
### 8a. `backend/modules/views/service.js`
`create` (`:24-52`): adicione `energy` ao destructuring (`:25-35`) e ao payload de `createForUser`.
`update` (`:54-87`): adicione `energy` ao destructuring (`:60-71`) e ao `updates` dict (`:73-83`).

### 8b. `backend/modules/views/validation.js`
Após `validateExtras` (`:28-49`), adicione:
```js
function validateEnergy(energy) {
    if (energy === null || energy === undefined) return null;
    const valid = ['low', 'medium', 'high'];
    if (!valid.includes(energy)) throw new ValidationError('Invalid energy');
    return energy;
}
```
Importe `ValidationError` (se já não). Chame em `create`/`update` do service.

### 8c. `backend/modules/search/validation.js` — `parseSearchParams` (`:6-55`)
Adicione `energy` aos params aceitos.

### 8d. `backend/modules/search/service.js`
Após aplicação de `priority` (busca por `Op.eq` no campo), adicione:
```js
if (energy) {
    taskWhere.energy = Task.getEnergyValue(energy);
}
```
Localize onde `priority` é aplicado (similar a `buildDateCondition` para due/defer) e espelhe.

## 9. Serializers
Garanta `energy` no response de task (spread `task.toJSON()` já inclui). View response: `views/service.js` retorna o model direto — campo já vem.

## 10. Frontend — TaskDetails card
Crie `frontend/components/Task/TaskDetails/TaskEnergyCard.tsx` (template `TaskAssignedToCard.tsx`):
```tsx
interface TaskEnergyCardProps {
    task: Task;
    onChange: (energy: 'low' | 'medium' | 'high' | null) => Promise<void>;
}
```
UI: dropdown/select com opções Low/Medium/High + "Clear". Handler em `TaskDetails.tsx`:
```tsx
const handleChangeEnergy = async (energy) => {
    if (!task?.uid) return;
    taskModifiedRef.current = true;
    await updateTask(task.uid, { energy });
    const updatedTask = await fetchTaskByUid(uid!);
    tasksStore.updateTaskInStore(updatedTask);
};
```
Renderize após `TaskWaitingSinceCard` (plano 50) ou após `TaskAssignedToCard` (`:1354`).

## 11. Frontend — UniversalSearch — `SearchMenu.tsx`
Adicione `energyOptions` (espelhe `priorityOptions` `:56-60`):
```tsx
const energyOptions = [
    { value: 'low', label: t('search.energyLow', 'Low energy') },
    { value: 'medium', label: t('search.energyMedium', 'Medium') },
    { value: 'high', label: t('search.energyHigh', 'High energy') },
];
```
State `selectedEnergy` (`:97-103`), toggle handler (espelhe `handlePriorityToggle`). Renderize badges (espelhe Priority badges `:514-536`). Repasse a `<SearchResults>` (`:716-725`) e ao body de save-view (`:176-185`).

## 12. Frontend — SaveViewModal — `SaveViewModal.tsx`
Adicione prop `energy?: string | null` (`:20-27`). Renderize select (espelhe `taskStatus` select `:170-184`). Adicione ao POST body (`:74-81`).

## 13. Frontend — Entity TS
`frontend/entities/Task.ts`: `energy?: 0 | 1 | 2 | null`.
`frontend/entities/View.ts` (se existir): `energy?: string | null`.

## 14. MCP — `backend/modules/mcp/tools/taskTools.js`
`create_task`/`update_task` schema: adicione `energy` (enum low/medium/high). `list_tasks`: adicione `energy` ao filtro (se o tool expõe filtros).

## 15. Testes — backend
`backend/tests/integration/tasks-energy.test.js`:
- create/update com `energy=2` → round-trip (response `energy: 2`).
- `GET /tasks?energy=low` → só `energy=0`.
- `GET /tasks?energy=invalid` → erro ou ignora (decidir; recomendo ignorar com warning).
- `GET /tasks?order_by=energy:desc` → ordena.
- View create com `energy=high` → `GET /views/:uid` retorna; search aplica filtro.
- task legada (energy=null) → aparece em listagem normal; não aparece em `?energy=low`.

## 16. Lint
```bash
cd backend && npx eslint --fix models/task.js models/view.js modules/tasks/queries/query-builders.js modules/tasks/service.js modules/tasks/core/builders.js modules/views/service.js modules/views/validation.js modules/search/service.js modules/search/validation.js modules/mcp/tools/taskTools.js migrations/20260718000003-add-energy-to-tasks.js migrations/20260718000004-add-energy-to-views.js
cd frontend && npx eslint --fix components/Task/TaskDetails/TaskEnergyCard.tsx components/Task/TaskDetails/index.ts components/Task/TaskDetails.tsx components/UniversalSearch/SearchMenu.tsx components/UniversalSearch/SaveViewModal.tsx entities/Task.ts
```

## Request / Response shapes
**POST /api/task**: `{ "name": "Revisar código", "energy": 2 }` → response `"energy": 2`.
**GET /api/tasks?energy=low**: tasks com `energy: 0`.
**POST /api/views**: `{ "name": "Low energy tasks", "energy": "low" }`.

## Critério de pronto
- [ ] `energy` coluna em tasks + views; validators 0-2.
- [ ] Filtro `/tasks?energy=` e View `energy` funcionam.
- [ ] `order_by=energy` ordena.
- [ ] TaskDetails tem card Energy; UniversalSearch tem slot; SaveViewModal tem select.
- [ ] Tasks legadas (energy=null) não quebram.
- [ ] Suítes verde; lint limpo.

## Commit
`feat(tasks): native energy field with filter and view support` — "Implements plans/51". Branch `feat/51-task-energy-field`, sem merge/push.

## Fora de escopo
- Energy boost no scoring Suggested de Today (fase 2).
- AI auto-sugerir energy no Inbox.
