# 56 — Stale task detection (`type=stale`)

> **Status: EXECUTADO** em 2026-07-19 — `case 'stale'` no query-builder, `User.stale_task_days` (migration `20260718000007`), título/subtítulo `?type=stale` no frontend (sem sidebar entry, uso via bookmark/54b), 9 testes de integração.
> **Esforço:** Baixo · **Natureza:** julgamento baixo · **Modelo:** baixo
> **Branch:** `feat/56-stale-task-detection` a partir da `main` · **Depende de:** -

## Contexto

GTD Weekly Review varre tasks "esquecidas": não-done, `updated_at` antiga. Stale ≠ overdue. Threshold configurável (default 30 dias). Consumido por 54b seção "Stale tasks". Endpoint `GET /tasks?type=stale&stale_days=30`.

## 1. Baseline
```bash
npm run backend:test && npm run frontend:test
```

## 2. Query-builder — `backend/modules/tasks/queries/query-builders.js`
No `switch(params.type)` (a partir de `:136`), adicione após `case 'waiting'` (`:302-304`):
```js
case 'stale': {
    const days = parseInt(params.stale_days ?? '30', 10);
    if (!Number.isFinite(days) || days < 1) throw new Error('Invalid stale_days');
    const cutoff = new Date(Date.now() - days * 86400000);
    whereClause.updated_at = { [Op.lt]: cutoff };
    whereClause.status = {
        [Op.notIn]: [Task.STATUS.DONE, Task.STATUS.ARCHIVED, Task.STATUS.CANCELLED, 'done', 'archived', 'cancelled'],
    };
    whereClause.recurring_parent_id = null; // instâncias não contam
    whereClause.is_someday = { [Op.ne]: true }; // someday revisado em seção própria (plano 49)
    whereClause.habit_mode = { [Op.ne]: true }; // hábitos não contam
    break;
}
```

## 3. Validation
`backend/modules/tasks/controller.js` `list` (`:19`): `params` é repassado direto. Sanitização de `stale_days` já no query-builder (parseInt + Number.isFinite + throw). Se throw, controller try/catch retorna erro. Confirmar que erro vira 400 (não 500) — ver `next(err)` + error handler em `app.js:438`.

## 4. Service
`backend/modules/tasks/service.js` `list` (`:202`): `type=stale` flui para `filterTasksByParams` (params passados direto). Sem lógica extra.

## 5. Endpoint
`GET /tasks?type=stale&stale_days=30` — rota já existe (`routes.js:19`). Sem mudança de rota. Opcional: `GET /tasks/metrics?type=stale` retorna count (metrics já delega via `getMetrics` `:194`).

## 6. User — threshold default
`backend/models/user.js`: adicione:
```js
stale_task_days: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 30, validate: { min: 1, max: 365 } },
```
Migration `backend/migrations/20260718000010-add-stale-task-days-to-users.js`:
```js
'use strict';
const { SAFE_ADD_COLUMNS } = require('../shared/migration-helpers');
module.exports = {
    async up(queryInterface, Sequelize) {
        await SAFE_ADD_COLUMNS(queryInterface, 'users', [
            { column: 'stale_task_days', type: Sequelize.INTEGER, allowNull: false, defaultValue: 30 },
        ]);
    },
    async down(queryInterface) { try { await queryInterface.removeColumn('users', 'stale_task_days'); } catch (e) {} },
};
```
Frontend Profile tab (opcional v1): input numérico "Stale threshold (days)". PATCH `/api/profile` com `stale_task_days`. Default 30 se null.

## 7. Frontend — Tasks list — `frontend/components/Task/Tasks.tsx`
Branch `?type=stale`: título "Stale tasks" + subtítulo "Not updated in N days". Reusar `TaskList`/`GroupedTaskList`. Sem novo componente. Detectar `type` via `searchParams.get('type')`.

## 8. Frontend — sidebar
Não adicionar entrada Stale na sidebar (fluxo natural é via Weekly Review 54b). Se user quiser acesso direto, bookmark `/tasks?type=stale&stale_days=30`.

## 9. Consumo por 54b
`backend/modules/reviews/service.js` `_findStaleTasks` (54b): chama query direta (já especificada em 54b) OU reusa `filterTasksByParams`. Preferido: query direta no reviews service (evita circular deps com tasks service).

## 10. Testes — backend
`backend/tests/integration/tasks-stale.test.js`:
- task updated há 40 dias, status not_started → em `type=stale&stale_days=30`.
- task updated há 10 dias → não.
- task done (mesmo há 100 dias) → não (excluída por status).
- task archived → não.
- task recurring instance (`recurring_parent_id` set) → não.
- task `is_someday=true` → não (revisada em someday section).
- task `habit_mode=true` → não.
- `stale_days=0` ou negativo → erro 400.
- `stale_days` ausente → default 30.

## 11. Lint
```bash
cd backend && npx eslint --fix models/user.js modules/tasks/queries/query-builders.js modules/tasks/controller.js migrations/20260718000010-add-stale-task-days-to-users.js
cd frontend && npx eslint --fix components/Task/Tasks.tsx
```

## Request / Response shapes
**GET /api/tasks?type=stale&stale_days=30**: tasks com `updated_at < hoje-30d`, não-done, não-recurring, não-someday, não-habit.
**GET /api/tasks?type=stale** (sem stale_days): default 30 dias.

## Critério de pronto
- [ ] `GET /tasks?type=stale&stale_days=N` retorna tasks stale.
- [ ] Threshold default 30 (User.stale_task_days); invalid `stale_days` → 400.
- [ ] Frontend branch `?type=stale` renderiza lista.
- [ ] 54b consome via service (sem SQL duplicado).
- [ ] Suítes verde; lint limpo.

## Commit
`feat(tasks): stale task detection (type=stale with stale_days)` — "Implements plans/56". Branch `feat/56-stale-task-detection`, sem merge/push.

## Desvios da execução

- Migration usa o helper real `safeAddColumns` de `backend/utils/migration-utils.js` (shape `{name, definition}`), não `SAFE_ADD_COLUMNS`/`shared/migration-helpers` citado no plano — esse último não existe no código.
- Erro de `stale_days` inválido lança `ValidationError` (padrão do arquivo, vira 400 via error handler), não `Error` genérico.
- Line numbers do plano (`case 'waiting'` em `:302-304`) estavam desatualizados; bloco real fica em `:323-336`.
- Frontend: sem alteração em `Tasks.tsx` (branch de type já é genérico, passa `type`/`stale_days` direto pra API). Título/subtítulo adicionados em `getTitleAndIcon.ts`/`getDescription.ts` (mesmo padrão de `today`/`inbox`/`someday`), com fallback inline via `t(key, default)` — sem tocar nos 24 arquivos de locale, seguindo o precedente dos planos 49/50/51 (nenhum tocou `public/locales`).
- Threshold `User.stale_task_days` sem UI de Profile (item "opcional v1" no plano) — fora de escopo v1.

## Fora de escopo
- Auto-arquivar stale (decisão humana na review).
- Notificação individual por task stale (coberto por Weekly Review notif 55).
- Threshold por Area/Project (global por user é suficiente v1).
