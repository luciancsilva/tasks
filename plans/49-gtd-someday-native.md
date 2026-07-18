# 49 — Someday/Maybe nativo (flag `is_someday`)

> **Status: EXECUTADO** em 2026-07-18 — `is_someday` column + model + service + query-builder (someday list + exclusion em today/upcoming/next/inbox/active) + sidebar NavLink + Tasks.tsx title via `getTitleAndIcon` já existente + TaskSomedayCard. 10 testes integração backend + 4 frontend. Suítes verdes (1747 backend / 116 frontend), typecheck limpo. Migration usa shape `safeAddColumns({name, definition})` (utils/migration-utils) — divergiu do snippet do plano que usava coluna em top-level.
> **Esforço:** Médio · **Natureza:** julgamento baixo · **Modelo:** médio
> **Branch:** `feat/49-gtd-someday` a partir da `main` · **Depende de:** -

## Contexto

GTD "Someday/Maybe" = itens não-actionáveis agora, guardados para revisão periódica, **fora** das listas de ação. Hoje no tududi é convenção frágil (tag + toggle + hide Kanban). Decisão: flag booleano `is_someday` ortogonal ao `status` (status enum 0-6 em `task.js:318-326` é lifecycle; someday é list-membership, não lifecycle — não vira status 7).

Retrocompat: tag `someday` continua funcionando; migration backfill copia tag→flag. Query-builder `type=someday` aceita `is_someday=true` **OR** tag `someday`.

## 1. Baseline
```bash
npm run backend:test && npm run frontend:test
```
Registre o resultado. Suíte vermelha na baseline = parar e reportar.

## 2. Migration
Crie `backend/migrations/20260718000001-add-is-someday-to-tasks.js`. Use o padrão `safeAddColumns` do fork (referência: `backend/migrations/20251124000001-add-defer-until.js`).

```js
'use strict';
const { SAFE_ADD_COLUMNS } = require('../shared/migration-helpers');

module.exports = {
    async up(queryInterface, Sequelize) {
        await SAFE_ADD_COLUMNS(queryInterface, 'tasks', [
            {
                column: 'is_someday',
                type: Sequelize.BOOLEAN,
                defaultValue: false,
                allowNull: false,
            },
        ]);
        // Backfill: tasks com tag someday → is_someday=true
        await queryInterface.sequelize.query(
            `UPDATE tasks SET is_someday = 1
             WHERE id IN (
                 SELECT tt.task_id FROM tasks_tags tt
                 INNER JOIN tags ON tags.id = tt.tag_id
                 WHERE tags.name = 'someday'
             )`
        );
    },
    async down(queryInterface, Sequelize) {
        try { await queryInterface.removeColumn('tasks', 'is_someday'); } catch (e) {}
    },
};
```
Valide o helper `SAFE_ADD_COLUMNS` em `backend/shared/migration-helpers.js` — ele só adiciona a coluna se a tabela existir e a coluna não existir (idempotente). Confirme o nome exato importando conforme os demais arquivos de `migrations/`.

## 3. Model — `backend/models/task.js`
Após `involves` (~linha 218), adicione:
```js
is_someday: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
},
```
**Não** alterar `Task.STATUS` (`:318-326`) — someday não é status.

## 4. Query-builder — `backend/modules/tasks/queries/query-builders.js`

### 4a. Substituir `case 'someday'` (`:297-301`)
Lógica atual (errada semanticamente):
```js
case 'someday':
    whereClause.recurring_parent_id = null;
    whereClause.due_date = null;
    whereClause.status = { [Op.notIn]: [Task.STATUS.DONE, 'done'] };
    break;
```
Substituir por:
```js
case 'someday': {
    // Someday nativo: is_someday=true OR tag 'someday' (retrocompat)
    const somedayTaggedIds = await sequelize.query(
        `SELECT DISTINCT tt.task_id FROM tasks_tags tt
         INNER JOIN tags ON tags.id = tt.tag_id WHERE tags.name = 'someday'`,
        { type: sequelize.QueryTypes.SELECT, raw: true }
    );
    const idList = somedayTaggedIds.map((r) => r.task_id);
    whereClause[Op.or] = [
        { is_someday: true },
        { id: { [Op.in]: idList } },
    ];
    break;
}
```

### 4b. Excluir someday das outras views
Nos cases `today` (`:137`), `upcoming` (`:205`), `next` (`:288`), `inbox` (`:293`) e no branch default (`:328`, `!client_side_filtering`), adicione **antes do `break`** de cada um:
```js
whereClause.is_someday = { [Op.ne]: true };
```
Cuidado: o branch default (`:328-329`) já monta `whereClause.status`; adicione a cláusula someday como AND adicional (não sobrescrever). Ex.:
```js
} else if (!params.client_side_filtering) {
    whereClause.status = { [Op.notIn]: [Task.STATUS.DONE, 'done'] };
    whereClause.is_someday = { [Op.ne]: true };
}
```

### 4c. Não excluir em `case 'all'`
`case 'all'` (`:305`) lista tudo — não filtrar someday aqui.

## 5. Service — `backend/modules/tasks/service.js`

### 5a. `create` (`:319`)
A função destrutura `name, project_id, project_uid, area_id, area_uid, parent_task_id, tags, Tags, people, People, subtasks` (`:320-332`). Adicione `is_someday` ao destructuring. Em `buildTaskAttributes` (helper em `./core/builders`), garanta que `is_someday` é repassado para `taskAttributes` (boolean, default false). Validação: se `is_someday=true` e `status` for `in_progress`/`done`, permitir (não bloquear — política futura).

### 5b. `update` (`:420`)
Destruture `is_someday` do `body` (`:421-432`). Se `is_someday !== undefined`, adicione a `taskAttributes` (`:549-551` dentro da transação). Sem auto-mutar outros campos.

### 5c. Serializer
Localize `backend/modules/tasks/core/serializers.js` (ou `taskWithoutSubtasks` spread). Garanta que `is_someday` aparece no JSON de resposta. Se o serializer usa spread de `task.toJSON()`, o campo já vem automaticamente após o model ganhar o campo. Valide com teste.

## 6. Rotas
`GET /tasks?type=someday` já funciona (`routes.js:19` → `controller.list` → `filterTasksByParams`). Sem rota nova.

## 7. Frontend — Sidebar — `frontend/components/Sidebar/SidebarNav.tsx`
No array `allNavLinks` (`:41-82`), adicione após o item Upcoming (`:53-57`):
```tsx
{
    path: '/tasks?type=someday',
    title: t('sidebar.someday', 'Someday'),
    icon: <SparklesIcon className="h-5 w-5" />,
    query: 'type=someday',
},
```
Importe `SparklesIcon` de `@heroicons/react/24/solid` (`:4-12`).
`isActive` (`:97-119`): o branch `/tasks` com query match (`:112-118`) já cobre `type=someday`.

## 8. Frontend — TaskDetails card
Crie `frontend/components/Task/TaskDetails/TaskSomedayCard.tsx`. Use `TaskAssignedToCard.tsx` como template (props `:9-12`, shell `:30-40`):
```tsx
interface TaskSomedayCardProps {
    task: Task;
    onToggle: (value: boolean) => Promise<void>;
}

const TaskSomedayCard: React.FC<TaskSomedayCardProps> = ({ task, onToggle }) => {
    const { t } = useTranslation();
    return (
        <div className="rounded-lg shadow-sm bg-white dark:bg-gray-900 border-2 border-transparent p-3">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <SparklesIcon className="h-5 w-5 text-gray-400" />
                    <span className="text-xs uppercase tracking-wide text-gray-500">
                        {t('task.someday', 'Someday/Maybe')}
                    </span>
                </div>
                <button
                    onClick={() => onToggle(!task.is_someday)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${task.is_someday ? 'bg-blue-600' : 'bg-gray-300'}`}
                    aria-pressed={task.is_someday}
                >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${task.is_someday ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
            </div>
        </div>
    );
};
export default TaskSomedayCard;
```
Exporte em `frontend/components/Task/TaskDetails/index.ts` (siga padrão L12).
Em `TaskDetails.tsx`: importe (`:24-37`), crie handler (espelhe `handleAssignPerson` `:1128-1141`):
```tsx
const handleToggleSomeday = async (value: boolean) => {
    if (!task?.uid) return;
    taskModifiedRef.current = true;
    await updateTask(task.uid, { is_someday: value });
    const updatedTask = await fetchTaskByUid(uid!);
    tasksStore.updateTaskInStore(updatedTask);
};
```
Renderize após `TaskAssignedToCard` (`:1354`):
```tsx
<TaskSomedayCard task={task} onToggle={handleToggleSomeday} />
```

## 9. Frontend — Entity TS
`frontend/entities/Task.ts`: adicione `is_someday?: boolean`.

## 10. Frontend — Tasks list page
`frontend/components/Task/Tasks.tsx`: quando `searchParams.get('type') === 'someday'`, título "Someday/Maybe". O `TaskList`/`GroupedTaskList` já renderizam tasks; sem mudança estrutural. Opcional: subtitle i18n "Items to review periodically".

## 11. Frontend — Today/Upcoming
Backend já exclui (`is_someday != true`). Confirmar que `TasksToday.tsx` e `Tasks.tsx?type=upcoming` não filtram client-side de forma a re-incluir. Hoje não fazem. Sem mudança.

## 12. Testes — backend `backend/tests/integration/`
Crie `tasks-someday.test.js` (siga padrão de `tasks.test.js`):
- task criada com `is_someday=true` → `GET /tasks?type=someday` retorna; `GET /tasks?type=today` **não** retorna.
- task criada sem flag, sem tag → não aparece em `type=someday`.
- task com tag `someday` (fixture) → aparece em `type=someday` (retrocompat).
- `PATCH /task/:uid` com `{ is_someday: true }` → persiste; `false` desfaz.
- Migration backfill: fixture task com tag `someday` → após migration `is_someday=true` (teste de migration isolado).

## 13. Testes — frontend
`frontend/__tests__/`: teste do `TaskSomedayCard` — toggle chama `onToggle(!task.is_someday)`.

## 14. Lint
```bash
cd backend && npx eslint --fix models/task.js modules/tasks/queries/query-builders.js modules/tasks/service.js modules/tasks/core/serializers.js modules/tasks/core/builders.js migrations/20260718000001-add-is-someday-to-tasks.js
cd frontend && npx eslint --fix components/Task/TaskDetails/TaskSomedayCard.tsx components/Task/TaskDetails/index.ts components/Task/TaskDetails.tsx components/Sidebar/SidebarNav.tsx entities/Task.ts
```

## Request / Response shapes
**POST /api/task** (create) — body ganha campo opcional:
```json
{ "name": "Aprender violino", "is_someday": true }
```
**PATCH /api/task/:uid** — body:
```json
{ "is_someday": true }
```
**GET /api/tasks?type=someday** — resposta: array de tasks com `is_someday: true` (ou tag someday). Cada task no response inclui `"is_someday": true|false`.

## Critério de pronto
- [ ] Migration cria `is_someday` + backfill tasks tag `someday`; idempotente.
- [ ] `GET /tasks?type=someday` retorna só `is_someday=true` (OU tag someday).
- [ ] Tasks com `is_someday=true` não aparecem em Today/Upcoming/Next/Inbox.
- [ ] Sidebar tem entrada "Someday" navegando para `/tasks?type=someday`.
- [ ] TaskDetails tem toggle Someday/Maybe; persiste via PATCH.
- [ ] Tag `someday` legada continua funcionando (retrocompat).
- [ ] Suítes verde; lint limpo.

## Commit
`feat(tasks): native Someday/Maybe flag (is_someday)` — corpo "Implements plans/49". Branch `feat/49-gtd-someday`, sem merge/push.

## Fora de escopo
- Someday em Projects/Areas (continua via tag).
- Sweep automático Someday→ação (pertence ao plano 54b — Weekly Review).
- Regra "someday + due_date = warning" bloqueante.
