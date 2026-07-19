# 57 — Multi-tag filter: AND + OR (`tags` + `tags_any`)

> **Status: EXECUTADO** em 2026-07-19 — `tags_any` (csv, OR) em `/tasks` e `/search` combinável com `tags`/`tag` (AND) via intersection de id sets (tasks) e subquery literal (search). View `tags_any` TEXT+JSON persiste e filtra. SearchMenu dois blocos "Tags (all)" + "Tags (any)". Desvios do plano: migration usa `safeAddColumns` (utils/migration-utils, não `SAFE_ADD_COLUMNS` shared); `sources`/in-app N/A; SaveViewModal não recebe tags (fluxo save inline no SearchMenu cobre `tags_any`). Search endpoint aceita csv `tags` (AND). View.tags é array JSON (AND). Sem OR. Decisão aprovada: dois campos explícitos — `tags` (AND, todas) + `tags_any` (OR, qualquer).
> **Esforço:** Médio · **Natureza:** julgamento baixo · **Modelo:** médio
> **Branch:** `feat/57-multi-tag-or` a partir da `main` · **Depende de:** -

## Contexto

Padrão Todoist/TickTick: filtrar por "tem todas estas tags" (AND) E/OU "tem qualquer destas" (OR). Combinaível: `tags=[work] AND tags_any=[@phone,@computer]` = tasks com tag work E (phone OU computer). Retrocompat: `tag` (singular) e `tags` (csv AND) continuam.

## 1. Baseline
```bash
npm run backend:test && npm run frontend:test
```

## 2. Migration — views
`backend/migrations/20260718000011-add-tags-any-to-views.js`:
```js
'use strict';
const { SAFE_ADD_COLUMNS } = require('../shared/migration-helpers');
module.exports = {
    async up(queryInterface, Sequelize) {
        await SAFE_ADD_COLUMNS(queryInterface, 'views', [
            { column: 'tags_any', type: Sequelize.TEXT, allowNull: true, defaultValue: null },
        ]);
    },
    async down(queryInterface) { try { await queryInterface.removeColumn('views', 'tags_any'); } catch (e) {} },
};
```
`tags_any` armazena JSON array de tag names (mesmo padrão `tags` `view.js:58-68` com getter/setter JSON).

## 3. Model — `backend/models/view.js`
Após `tags` (`:58-68`), adicione (espelhe o getter/setter JSON):
```js
tags_any: {
    type: DataTypes.TEXT,
    allowNull: true,
    defaultValue: null,
    get() {
        const raw = this.getDataValue('tags_any');
        if (!raw) return [];
        try { return JSON.parse(raw); } catch (e) { return []; }
    },
    set(value) {
        if (value === null || value === undefined) {
            this.setDataValue('tags_any', null);
        } else {
            this.setDataValue('tags_any', JSON.stringify(value));
        }
    },
},
```

## 4. Query-builder — `backend/modules/tasks/queries/query-builders.js`

### 4a. `/tasks` endpoint
Hoje `if (params.tag)` (`:407`) aceita UMA tag (subquery SQL). Adicionar `tags_any` (csv de nomes, OR):
```js
if (params.tags_any) {
    const tagNames = params.tags_any.split(',').map(s => s.trim()).filter(Boolean);
    if (tagNames.length > 0) {
        const anyTaggedIds = await sequelize.query(
            `SELECT DISTINCT tt.task_id FROM tasks_tags tt
             INNER JOIN tags ON tags.id = tt.tag_id
             WHERE tags.name IN (:names)`,
            { replacements: { names: tagNames }, type: sequelize.QueryTypes.SELECT, raw: true }
        );
        const idList = anyTaggedIds.map(r => r.task_id);
        // OR: task tem qualquer uma das tags
        // combinar com AND existente (params.tag) via Op.and
        if (idList.length === 0) {
            whereClause.id = { [Op.in]: [] }; // nada match
        } else {
            whereClause.id = { [Op.in]: idList };
        }
    }
}
```
Cuidado: se `params.tag` (singular AND) e `params.tags_any` coexistem, o AND se dá por ambas cláusulas `whereClause` (tag singular já aplica via subquery separada em `:407-414`). Verificar se `params.tag` seta `whereClause` diretamente ou usa flag — reler `:407-432`. Se `tag` singular usa `tagFilteredTaskIds` + `Op.in` depois, combinar com `tags_any` ids via intersection (AND entre os dois conjuntos). Implementar com cuidado.

### 4b. Search endpoint (multi-entity)
`backend/modules/search/service.js` `buildTaskInclude` (`:165-195`): hoje `tagInclude.where = { id: { [Op.in]: tagIds } }` + `required: true` (AND all). Para `tags_any` (OR), adicionar um segundo include OU subquery:
```js
// Após buildTaskInclude existente (AND):
if (tagsAnyIds && tagsAnyIds.length > 0) {
    // OR: subquery — task_id IN (tasks com qualquer das tags_any)
    taskWhere[Op.and] = [
        ...(taskWhere[Op.and] || []),
        sequelize.where(
            sequelize.literal(
                `(SELECT COUNT(*) FROM tasks_tags tt2 INNER JOIN tags t2 ON t2.id = tt2.tag_id WHERE tt2.task_id = Task.id AND t2.id IN (${tagsAnyIds.join(',')}))`
            ),
            '>=', 1
        ),
    ];
}
```
`tagsAnyIds` resolvido a partir de `tags_any` (csv names) → `Tag.findAll({ where: { user_id, name: { [Op.in]: names } } })` → ids.

## 5. Search validation — `backend/modules/search/validation.js` `parseSearchParams` (`:6-55`)
Adicione `tags_any` (csv string) aos params aceitos.

## 6. Views service + validation
### 6a. `backend/modules/views/service.js`
`create` (`:24-52`): destruture `tags_any` (`:25-35`), persista.
`update` (`:54-87`): destruture `tags_any` (`:60-71`), adicione ao `updates` (`:73-83`).
### 6b. `backend/modules/views/validation.js`
```js
function validateTagsAny(tagsAny) {
    if (tagsAny === null || tagsAny === undefined) return null;
    if (!Array.isArray(tagsAny)) throw new ValidationError('tags_any must be array');
    return tagsAny.filter(t => typeof t === 'string' && t.trim().length > 0);
}
```

## 7. Frontend — SearchMenu — `frontend/components/UniversalSearch/SearchMenu.tsx`

### 7a. State
Após `selectedTags` (`:102`), adicione:
```tsx
const [selectedTagsAny, setSelectedTagsAny] = useState<string[]>([]);
```
Handler `handleTagAnyToggle` (espelhe `handleTagToggle` `:143-149`).

### 7b. UI
Após o bloco de Tags badges (`:580-602`), adicione bloco "Tags (any)":
```tsx
<div className="mt-2">
    <span className="text-xs text-gray-500">{t('search.tagsAny', 'Has any of these tags')}</span>
    <div className="flex flex-wrap gap-1 mt-1">
        {availableTags.map(tag => (
            <button
                key={tag.uid}
                onClick={() => handleTagAnyToggle(tag.name)}
                className={`px-2 py-1 text-xs rounded ${selectedTagsAny.includes(tag.name) ? 'bg-green-600 text-white' : 'bg-gray-200 dark:bg-gray-700'}`}
            >
                {tag.name}
            </button>
        ))}
    </div>
</div>
```

### 7c. Pass-through
Repasse `selectedTagsAny` a `<SearchResults>` (`:716-725`) como prop `selectedTagsAny`. Adicione ao save-view body (`:176-185`):
```tsx
tags_any: selectedTagsAny.length > 0 ? selectedTagsAny : undefined,
```

## 8. Frontend — SaveViewModal — `SaveViewModal.tsx`
Adicione prop `tags_any?: string[]`. No POST body (`:74-81`), inclua `tags_any`. O modal hoje recebe tags do parent como props read-only (`:150-159`) — espelhe para tags_any.

## 9. Frontend — ViewDetail
`frontend/components/ViewDetail.tsx`: exibir chips de `tags_any` (espelhe chips de tags existentes). Aplicar filtro: se view tem `tags_any`, filtrar client-side OU re-buscar via search com `tags_any` param. Preferido: passar `tags_any` ao `searchUniversal` call.

## 10. Testes — backend
`backend/tests/integration/tasks-multi-tag.test.js`:
- `GET /tasks?tags_any=phone,computer` → tasks com tag phone OU computer.
- `GET /tasks?tag=work&tags_any=phone,computer` → tasks com tag work AND (phone OU computer).
- `GET /tasks?tags_any=nonexistent` → vazio.
- View com `tags_any=['phone','computer']` → search retorna tasks com qualquer das tags.
- View com `tags=['work']` AND `tags_any=['phone','computer']` → work AND (phone OR computer).
- Retrocompat: View antiga sem `tags_any` → funciona igual.

## 11. Lint
```bash
cd backend && npx eslint --fix models/view.js modules/tasks/queries/query-builders.js modules/views/service.js modules/views/validation.js modules/search/service.js modules/search/validation.js migrations/20260718000011-add-tags-any-to-views.js
cd frontend && npx eslint --fix components/UniversalSearch/SearchMenu.tsx components/UniversalSearch/SaveViewModal.tsx components/Views/ViewDetail.tsx
```

## Request / Response shapes
**GET /api/tasks?tags_any=phone,computer** — tasks com qualquer das tags.
**GET /api/search?tags=work&tags_any=phone,computer** — tasks com work AND (phone OR computer).
**POST /api/views**: `{ "name": "Work calls", "tags": ["work"], "tags_any": ["phone","computer"] }`.

## Critério de pronto
- [ ] `tags_any` (csv) em `/tasks` e `/search` → OR semantic.
- [ ] `tags` (AND) + `tags_any` (OR) combináveis.
- [ ] View `tags_any` persiste + filtra.
- [ ] SearchMenu tem dois campos: "Todas" (AND) + "Qualquer" (OR).
- [ ] Retrocompat: `tag` singular e View antiga sem `tags_any` funcionam.
- [ ] Suítes verde; lint limpo.

## Commit
`feat(tasks): multi-tag filter with AND (tags) and OR (tags_any)` — "Implements plans/57". Branch `feat/57-multi-tag-or`, sem merge/push.

## Fora de escopo
- Tag prefix/wildcard filter (`tags=phone*`) — plano futuro.
- Negation (`tags_none`) — plano futuro.
