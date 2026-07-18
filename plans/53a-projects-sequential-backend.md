# 53a — Projects sequential vs parallel (backend)

> **Status: PROPOSTO** — Todos projetos são paralelos hoje. Subtasks têm `order` (`task.js:153`) mas é display order, não dependency. GTD "sequential project" = só a próxima action visível; completar revela a seguinte. Sem `execution_mode` flag.
> **Esforço:** Médio · **Natureza:** julgamento médio · **Modelo:** médio
> **Branch:** `feat/53-projects-sequential` a partir da `main` · **Depende de:** -

## Contexto

GTD projetos paralelos (qualquer task actionável) ou sequenciais (encadeadas, só primeira actionável). Things 3 / Todoist suportam. `Project.status` ENUM em `project.js:127-128`. `is_maintenance` flag `:95`. Add `execution_mode` enum `parallel`/`sequential`, default `parallel`.

Semântica sequential: tasks do projeto ordenadas por `order` ASC (null last) → primeira não-done = "next action"; demais ocultas das listas de ação (Today/Next/Upcoming). Completar primeira → segunda vira next. Não bloqueia edição direta (user pode abrir projeto e ver todas).

## 1. Baseline
```bash
npm run backend:test && npm run frontend:test
```

## 2. Migration
`backend/migrations/20260718000007-add-execution-mode-to-projects.js`:
```js
'use strict';
const { SAFE_ADD_COLUMNS } = require('../shared/migration-helpers');
module.exports = {
    async up(queryInterface, Sequelize) {
        await SAFE_ADD_COLUMNS(queryInterface, 'projects', [
            { column: 'execution_mode', type: Sequelize.STRING, allowNull: false, defaultValue: 'parallel' },
        ]);
    },
    async down(queryInterface) { try { await queryInterface.removeColumn('projects', 'execution_mode'); } catch (e) {} },
};
```
SQLite não suporta ADD COLUMN com ENUM nativo — Sequelize mapeia ENUM como STRING com validate (padrão do fork: `Goal.horizon` `goal.js:43`).

## 3. Model — `backend/models/project.js`
Após `is_maintenance` (~linha 95):
```js
execution_mode: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'parallel',
    validate: { isIn: [['parallel', 'sequential']] },
},
```

## 4. Service — `backend/modules/projects/service.js`

### 4a. `getAll` (`:86`)
Incluir `execution_mode` no retorno (o service espelha Project via repository includes — campo vem automaticamente após model). Stalled logic (`:172-175`): para sequential, `activeTaskCount` continua mesmo cálculo (zero active = stalled).

Adicionar `next_action_task` por projeto (opcional v1, útil para 53b): para cada projeto sequential, computar primeira task não-done por `order`:
```js
if (project.execution_mode === 'sequential') {
    const tasks = project.Tasks || [];
    const sorted = [...tasks].sort((a, b) => {
        if (a.order == null && b.order == null) return 0;
        if (a.order == null) return 1;
        if (b.order == null) return -1;
        return a.order - b.order;
    });
    const nextAction = sorted.find(t => ![2, 3, 5].includes(t.status)); // não done/archived/cancelled
    project.next_action_task = nextAction ? { uid: nextAction.uid, name: nextAction.name } : null;
}
```

### 4b. `getByUid` (`:217`)
Incluir `execution_mode` no response. Tasks retornadas: todas (frontend 53b decide visibilidade).

### 4c. `create` (`:285`) e `update` (`:346`)
Aceitar `execution_mode` no body; validar `parallel|sequential`. Em `create`: adicione ao payload de `projectsRepository.create`. Em `update`: adicione ao `updates` dict se `!== undefined`.

## 5. Query-builder — `backend/modules/tasks/queries/query-builders.js`

Nos cases `today` (`:137`), `upcoming` (`:205`), `next` (`:288`), excluir tasks de projetos sequential que **não** sejam a primeira não-done. Implementação via subquery:

```js
// Helper no topo do módulo (após imports):
const SEQUENTIAL_NEXT_ACTION_FILTER = sequelize.literal(
    `(projects.execution_mode = 'parallel') OR (
        projects.execution_mode = 'sequential' AND tasks.id = (
            SELECT t2.id FROM tasks t2
            WHERE t2.project_id = tasks.project_id
              AND t2.status NOT IN (2, 3, 5)
            ORDER BY (t2.order IS NULL), t2.order ASC
            LIMIT 1
        )
    ))`
);
```

Para aplicar, é necessário que a query faça JOIN com `projects`. Verifique se o `findAll` do tasks já inclui Project (provavelmente não por padrão no query-builder). Alternativa mais simples (preferida): subquery na cláusula WHERE via `Op.in`:

```js
// Antes do switch, dentro de filterTasksByParams, após montar whereClause base:
function sequentialNextActionWhereClause() {
    return {
        [Op.or]: [
            { project_id: null },
            { is_someday: true },
            sequelize.where(
                sequelize.literal(
                    `tasks.id = COALESCE((
                        SELECT t2.id FROM tasks t2
                        INNER JOIN projects p ON p.id = t2.project_id
                        WHERE t2.project_id = tasks.project_id
                          AND p.execution_mode = 'sequential'
                          AND t2.status NOT IN (2,3,5)
                        ORDER BY (t2.order IS NULL), t2.order ASC
                        LIMIT 1
                    ), -1)`
                ),
                sequelize.col('tasks.id')
            ),
            // tasks cujo projeto é parallel — incluir todas:
            sequelize.literal(
                `EXISTS (SELECT 1 FROM projects p WHERE p.id = tasks.project_id AND p.execution_mode = 'parallel')`
            ),
        ],
    };
}
```

Aplicar nos cases `today`/`upcoming`/`next`:
```js
case 'today':
    // ... whereClause existente ...
    whereClause.is_someday = { [Op.ne]: true }; // plano 49
    Object.assign(whereClause, sequentialNextActionWhereClause());
    break;
```
Cuidado: `Object.assign` com `Op.or` — se o case já tem `Op.or`, mesclar. Verificar caso a caso. Para `today`/`next`/`upcoming` provavelmente não há `Op.or` existente; adicionar direto.

**Não aplicar** em `case 'all'` (`:305`), `case 'waiting'`, `case 'someday'`, nem quando `params.project_uid`/`params.project_id` setado (dentro do projeto, ver todas).

## 6. Serializer — tasks
`backend/modules/tasks/core/serializers.js`: adicionar campo computado `is_project_next_action` boolean. Para compute, comparar task.id com a subquery de next action do projeto (ou repassar `next_action_task` do projeto em 4a). Simplificação: o serializer não computa; o frontend (53b) destaca a primeira task não-done quando `project.execution_mode === 'sequential'`.

## 7. MCP — `backend/modules/mcp/tools/projectTools.js`
`create_project`/`update_project` schema: adicione `execution_mode` (enum parallel/sequential). `list_projects`/`get_project`: campo já vem no response.

## 8. Testes — backend
`backend/tests/integration/projects-sequential.test.js`:
- migration cria coluna; projeto legado = parallel.
- `PATCH /project/:uid` com `execution_mode='sequential'` persiste; `GET /project/:uid` retorna.
- `GET /tasks?type=today` com projeto sequential de 3 tasks (order 1,2,3; todas not_started) → retorna só task order=1.
- Completar task order=1 (PATCH status=done) → `GET /tasks?type=today` retorna task order=2.
- Projeto parallel: todas tasks aparecem em today.
- `GET /tasks?type=all` mostra todas do projeto sequential (não oculta).
- `GET /tasks?project_uid=<sequential_proj>` mostra todas (dentro do projeto).
- Stalled: projeto sequential com todas done = stalled; com 0 tasks = stalled.

## 9. Lint
```bash
cd backend && npx eslint --fix models/project.js modules/projects/service.js modules/tasks/queries/query-builders.js modules/mcp/tools/projectTools.js migrations/20260718000007-add-execution-mode-to-projects.js
```

## Request / Response shapes
**POST /api/project**: `{ "name": "Site redesign", "execution_mode": "sequential" }` → response `"execution_mode": "sequential"`.
**GET /api/tasks?type=today** — tasks de projeto sequential: só next action. Response de task pode incluir `"project_execution_mode": "sequential"` (opcional, se serializer enriquecer).
**GET /api/project/:uid** — response inclui `"execution_mode": "sequential"`, `next_action_task: { uid, name }`.

## Critério de pronto
- [ ] `execution_mode` coluna; default parallel; validator.
- [ ] create/update aceitam; getByUid/getAll retornam.
- [ ] `GET /tasks` Today/Next/Upcoming oculta non-next tasks de projetos sequential.
- [ ] Completar next revela seguinte.
- [ ] `type=all` e view por projeto mostram todas.
- [ ] Stalled logic funciona para ambos modos.
- [ ] Suítes verde; lint limpo.

## Commit
`feat(projects): sequential vs parallel execution_mode (backend)` — "Implements plans/53a". Branch `feat/53-projects-sequential`, sem merge/push. 53a + 53b mesma branch.

## Fora de escopo
- Dependências arbitrárias entre tasks (`depends_on`/`blocked_by`) — só sequential por `order`.
- Drag reorder subtasks (plano 64).
- UI completa do ProjectModal (plano 53b).
