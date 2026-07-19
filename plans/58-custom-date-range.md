# 58 — Custom date range (`due_from` / `due_to`) + presets

> **Status: EXECUTADO** em 2026-07-19 — `due_from`/`due_to` (DATEONLY, YYYY-MM-DD) em `/tasks` (Op.gte/Op.lte) e `/search` (`buildDateRangeCondition`, sobrepõe bucket `due` quando setado). View persiste + valida (`due_from > due_to` → 400). SearchMenu date pickers após presets; ViewDetail chips range. Retrocompat: buckets `due='today'` etc. mantidos. Sem range arbitrário. Decisão aprovada: manter presets + adicionar custom range.
> **Esforço:** Médio · **Natureza:** julgamento baixo · **Modelo:** médio
> **Branch:** `feat/58-custom-date-range` a partir da `main` · **Depende de:** -

## Contexto

Custom range cobre casos: "próximas 2 semanas", "mês passado", "between Jul 15 and Jul 30". Presets continuam para quick access. Retrocompat: View antiga com `due='today'` continua funcionando; `due_from`/`due_to` (se setados) sobrepõem bucket.

## 1. Baseline
```bash
npm run backend:test && npm run frontend:test
```

## 2. Migration — views
`backend/migrations/20260718000012-add-due-range-to-views.js`:
```js
'use strict';
const { SAFE_ADD_COLUMNS } = require('../shared/migration-helpers');
module.exports = {
    async up(queryInterface, Sequelize) {
        await SAFE_ADD_COLUMNS(queryInterface, 'views', [
            { column: 'due_from', type: Sequelize.DATEONLY, allowNull: true, defaultValue: null },
            { column: 'due_to', type: Sequelize.DATEONLY, allowNull: true, defaultValue: null },
        ]);
    },
    async down(queryInterface) {
        try { await queryInterface.removeColumn('views', 'due_from'); } catch (e) {}
        try { await queryInterface.removeColumn('views', 'due_to'); } catch (e) {}
    },
};
```
DATEONLY (sem timezone) — range de dias.

## 3. Model — `backend/models/view.js`
Após `due` (`:50`):
```js
due_from: { type: DataTypes.DATEONLY, allowNull: true, defaultValue: null },
due_to: { type: DataTypes.DATEONLY, allowNull: true, defaultValue: null },
```

## 4. Query-builder — `backend/modules/tasks/queries/query-builders.js`
Adicionar params `due_from`/`due_to` ao `/tasks` endpoint:
```js
if (params.due_from || params.due_to) {
    const range = {};
    if (params.due_from) range[Op.gte] = new Date(params.due_from);
    if (params.due_to) {
        const end = new Date(params.due_to);
        end.setHours(23, 59, 59, 999);
        range[Op.lte] = end;
    }
    whereClause.due_date = range;
}
```
Inserir após bloco `if (params.priority)` (`:365-367`). Não conflita com `type` (que não filtra due_date exceto upcoming/today que usam buckets próprios). Se user passar `type=today` + `due_from`, `type` ganha — documentar.

## 5. Search service — `backend/modules/search/service.js` `buildDateCondition` (`:15-46`)
Estender para aceitar absolute range. Adicionar branch default ou novo método:
```js
function buildDateRangeCondition(dueFrom, dueTo, fieldName) {
    if (!dueFrom && !dueTo) return null;
    const range = {};
    if (dueFrom) range[Op.gte] = new Date(dueFrom);
    if (dueTo) {
        const end = new Date(dueTo);
        end.setHours(23, 59, 59, 999);
        range[Op.lte] = end;
    }
    return { [fieldName]: range };
}
```
Em `search()` (`:528-635`): se `dueFrom`/`dueTo` presentes, usar `buildDateRangeCondition` em vez de `buildDateCondition(due, ...)`. Se ambos (bucket + range) presentes, range sobrepõe (ou AND — decidir; recomendo range sobrepõe para simplicidade).

## 6. Search validation — `backend/modules/search/validation.js` `parseSearchParams` (`:6-55`)
Adicione `due_from`, `due_to` (ISO date strings YYYY-MM-DD) aos params.

## 7. Views service + validation
### 7a. `backend/modules/views/service.js`
`create`/`update`: destruture `due_from`, `due_to`, persista.
### 7b. `backend/modules/views/validation.js`
```js
function validateDateRange(dueFrom, dueTo) {
    const from = dueFrom ? new Date(dueFrom) : null;
    const to = dueTo ? new Date(dueTo) : null;
    if (from && isNaN(from.getTime())) throw new ValidationError('Invalid due_from');
    if (to && isNaN(to.getTime())) throw new ValidationError('Invalid due_to');
    if (from && to && from > to) throw new ValidationError('due_from after due_to');
    return { due_from: dueFrom || null, due_to: dueTo || null };
}
```

## 8. Frontend — SearchMenu — `frontend/components/UniversalSearch/SearchMenu.tsx`

### 8a. State
Após `selectedDue` (`:100`):
```tsx
const [dueFrom, setDueFrom] = useState<string | null>(null);
const [dueTo, setDueTo] = useState<string | null>(null);
```

### 8b. UI
Após bloco Due badges (`:538-557`), adicione "Custom range":
```tsx
<div className="mt-2 flex items-center gap-2">
    <span className="text-xs text-gray-500">{t('search.customRange', 'Custom range')}</span>
    <input type="date" value={dueFrom || ''} onChange={(e) => setDueFrom(e.target.value || null)} className="text-xs border rounded px-1 py-0.5" />
    <span className="text-xs">→</span>
    <input type="date" value={dueTo || ''} onChange={(e) => setDueTo(e.target.value || null)} className="text-xs border rounded px-1 py-0.5" />
    {(dueFrom || dueTo) && (
        <button onClick={() => { setDueFrom(null); setDueTo(null); }} className="text-xs text-red-500">✕</button>
    )}
</div>
```
Native `<input type="date">` (sem react-datepicker — confirmado não é dep).

### 8c. Pass-through
Repasse `dueFrom`/`dueTo` a `<SearchResults>` (`:716-725`). Ao save-view body (`:176-185`):
```tsx
due_from: dueFrom || undefined,
due_to: dueTo || undefined,
```

## 9. Frontend — SaveViewModal
Adicione props `due_from?: string | null`, `due_to?: string | null`. No POST body (`:74-81`), inclua. Exiba no summary read-only (`:150-159`) se setados.

## 10. Frontend — ViewDetail
`ViewDetail.tsx`: exibir chips de range ("Jul 15 → Jul 30") se `view.due_from`/`view.due_to`. Aplicar filtro ao `searchUniversal` call.

## 11. Testes — backend
`backend/tests/integration/tasks-date-range.test.js`:
- `GET /tasks?due_from=2026-07-15&due_to=2026-07-30` → tasks com due_date naquele range.
- `GET /tasks?due_from=2026-07-15` (só from) → tasks com due_date >= 2026-07-15.
- `GET /tasks?due_to=2026-07-30` (só to) → tasks com due_date <= 2026-07-30 23:59.
- View com `due_from`/`due_to` → search aplica range.
- View com `due='today'` (bucket) → continua funcionando (retrocompat).
- View com `due_from` + `due='today'` → range sobrepõe (ou AND; documentar escolha).
- `due_from > due_to` → erro 400.

## 12. Lint
```bash
cd backend && npx eslint --fix models/view.js modules/tasks/queries/query-builders.js modules/views/service.js modules/views/validation.js modules/search/service.js modules/search/validation.js migrations/20260718000012-add-due-range-to-views.js
cd frontend && npx eslint --fix components/UniversalSearch/SearchMenu.tsx components/UniversalSearch/SaveViewModal.tsx components/Views/ViewDetail.tsx
```

## Request / Response shapes
**GET /api/tasks?due_from=2026-07-15&due_to=2026-07-30** — tasks com due_date no range.
**POST /api/views**: `{ "name": "Sprint 2", "due_from": "2026-07-15", "due_to": "2026-07-30" }`.
**GET /api/search?due_from=2026-07-15** — tasks from Jul 15 onwards.

## Critério de pronto
- [ ] `due_from`/`due_to` em `/tasks` e `/search` → `Op.between`/`Op.gte`+`Op.lte`.
- [ ] View `due_from`/`due_to` persiste + filtra.
- [ ] SearchMenu tem date pickers custom range após presets.
- [ ] Retrocompat: buckets (`due='today'` etc.) continuam.
- [ ] `due_from > due_to` → 400.
- [ ] Suítes verde; lint limpo.

## Commit
`feat(tasks): custom date range filter with presets retained` — "Implements plans/58". Branch `feat/58-custom-date-range`, sem merge/push.

## Fora de escopo
- `defer_from`/`defer_to` (tickler range) — mesmo padrão, plano futuro se demandado.
- Presets customizados salvos pelo user.
