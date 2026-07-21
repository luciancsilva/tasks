# 69 — Inbox bulk process (select + process-all/delete-all/mark-all)

> **Status: EXECUTADO** em 2026-07-19 — `POST /inbox/bulk` (process-to-tasks) +
> `/inbox/bulk-delete` + `/inbox/bulk-mark-processed` + selection UI. Revisado
> 2026-07-20: escopado por `user_id`; delete/mark-processed em transação.

> **Status: PROPOSTO** — Inbox item-a-item sem bulk. Decisão aprovada: checkbox multi + toolbar (Process all as Task / Delete all / Mark all processed).
> **Esforço:** Médio · **Natureza:** julgamento baixo · **Modelo:** médio
> **Branch:** `feat/69-inbox-bulk` a partir da `main` · **Depende de:** -

## Contexto

Refs:
- `InboxItems.tsx` lista `:522-537` (`inboxItems.map(item => <InboxItemDetail />/`), pagination `:539-581`.
- `InboxItemDetail.tsx` props `:28-36` — precisa de `isSelected` + `onToggleSelect`.
- `inbox/routes.js` — `POST /inbox/bulk` insere após `:10` (`POST /inbox`), antes `:uid` routes.
- `inbox/service.js` `process` `:133-145` (mark status='processed'), `delete` `:116` (soft delete status='deleted').
- Transaction pattern: `inbox/service.js` não usa tx hoje — adicionar para atomicidade bulk.

Operações: **Process all as Task** (abre modal pré-preenchido com tags/project comuns → cria tasks + marca processed), **Delete all** (confirm → soft delete), **Mark all processed** (status='processed' sem criar task).

## 1. Baseline
```bash
npm run backend:test && npm run frontend:test
```

## 2. Backend — endpoint bulk
`backend/modules/inbox/routes.js` após `:10`:
```js
router.post('/inbox/bulk', inboxController.bulkProcess);
router.post('/inbox/bulk-delete', inboxController.bulkDelete);
router.post('/inbox/bulk-mark-processed', inboxController.bulkMarkProcessed);
```

## 3. Controller — `backend/modules/inbox/controller.js`
```js
async bulkProcess(req, res, next) {
    try {
        const userId = requireUserId(req);
        const { uids, sharedTags, sharedProjectUid, sharedAreaUid } = req.body;
        const result = await inboxService.bulkProcessToTasks(userId, uids, { sharedTags, sharedProjectUid, sharedAreaUid });
        res.json(result);
    } catch (err) { next(err); }
}

async bulkDelete(req, res, next) {
    try {
        const userId = requireUserId(req);
        const { uids } = req.body;
        const result = await inboxService.bulkDelete(userId, uids);
        res.json(result);
    } catch (err) { next(err); }
}

async bulkMarkProcessed(req, res, next) {
    try {
        const userId = requireUserId(req);
        const { uids } = req.body;
        const result = await inboxService.bulkMarkProcessed(userId, uids);
        res.json(result);
    } catch (err) { next(err); }
}
```

## 4. Service — `backend/modules/inbox/service.js`
```js
const { sequelize } = require('../../database');
const { InboxItem } = require('../../models');
const inboxProcessingService = require('./inboxProcessingService');
const tasksService = require('../tasks/service');

async bulkProcessToTasks(userId, uids, shared) {
    if (!Array.isArray(uids) || uids.length === 0) throw new ValidationError('uids required');
    const created = []; const failed = [];
    await sequelize.transaction(async (t) => {
        for (const uid of uids) {
            try {
                const item = await InboxItem.findOne({ where: { uid, user_id: userId } });
                if (!item) { failed.push({ uid, reason: 'not found' }); continue; }
                const parsed = inboxProcessingService.processInboxItem(item.content);
                await tasksService.create(userId, 'UTC', {
                    name: parsed.cleaned_content || item.content,
                    tags: [...(parsed.parsed_tags || []), ...(shared.sharedTags || [])],
                    project_uid: parsed.parsed_projects[0] || shared.sharedProjectUid,
                    area_uid: shared.sharedAreaUid,
                    priority: parsed.parsed_priority,
                });
                await item.update({ status: 'processed' }, { transaction: t });
                created.push(uid);
            } catch (e) { failed.push({ uid, reason: e.message }); }
        }
    });
    return { created, failed };
}

async bulkDelete(userId, uids) {
    if (!Array.isArray(uids) || uids.length === 0) throw new ValidationError('uids required');
    const deleted = []; const failed = [];
    await sequelize.transaction(async (t) => {
        for (const uid of uids) {
            try {
                const item = await InboxItem.findOne({ where: { uid, user_id: userId } });
                if (!item) { failed.push({ uid, reason: 'not found' }); continue; }
                await item.update({ status: 'deleted' }, { transaction: t });
                deleted.push(uid);
            } catch (e) { failed.push({ uid, reason: e.message }); }
        }
    });
    return { deleted, failed };
}

async bulkMarkProcessed(userId, uids) {
    if (!Array.isArray(uids) || uids.length === 0) throw new ValidationError('uids required');
    const processed = []; const failed = [];
    await sequelize.transaction(async (t) => {
        for (const uid of uids) {
            try {
                const item = await InboxItem.findOne({ where: { uid, user_id: userId } });
                if (!item) { failed.push({ uid, reason: 'not found' }); continue; }
                await item.update({ status: 'processed' }, { transaction: t });
                processed.push(uid);
            } catch (e) { failed.push({ uid, reason: e.message }); }
        }
    });
    return { processed, failed };
}
```
Nota: `tasksService.create` tem sua própria transaction (`service.js:385-397`). Chamar dentro tx outer cria nesting — Sequelize SQLite não suporta nested tx bem. Solução: `tasksService.create` sem tx outer (chama fora), OU refatorar `create` para aceitar `{ transaction }` opcional (padrão fork). Recomendado: chamar `tasksService.create` **fora** da tx outer (uma task por vez, não-atômico com inbox update), mas inbox update atômico. Reportar failures. Alternativa: refatorar `create` para aceitar tx (mais limpo, mais trabalho). V1: tasksService.create fora de tx; inbox update em tx própria.

## 5. Frontend — selection state
`InboxItems.tsx` (`:31` component): adicione:
```tsx
const [selectedUids, setSelectedUids] = useState<Set<string>>(new Set());
const [selectionMode, setSelectionMode] = useState(false);
const toggleSelect = (uid: string) => setSelectedUids(prev => {
    const next = new Set(prev);
    next.has(uid) ? next.delete(uid) : next.add(uid);
    return next;
});
```
Toggle "Select" no header.

## 6. Frontend — InboxItemDetail props
`InboxItemDetail.tsx` props (`:28-36`): adicione `isSelected?: boolean`, `onToggleSelect?: () => void`. No render (`:903-934`), se `selectionMode`, checkbox antes do conteúdo:
```tsx
{selectionMode && <input type="checkbox" checked={isSelected} onChange={onToggleSelect} />}
```

## 7. Frontend — InboxBulkToolbar
Novo `frontend/components/Inbox/InboxBulkToolbar.tsx`:
```tsx
interface InboxBulkToolbarProps {
    selectedUids: Set<string>;
    onClear: () => void;
    onProcessAllAsTasks: (shared: { tags?: string[]; projectUid?: string; areaUid?: string }) => Promise<void>;
    onDeleteAll: () => Promise<void>;
    onMarkAllProcessed: () => Promise<void>;
}
```
Floating bottom: count + "Process all as Task" (abre sub-modal com tags/project comuns) + "Mark all processed" + "Delete all" (confirm).

## 8. Frontend — handlers em InboxItems
```tsx
const handleProcessAllAsTasks = async (shared) => {
    const result = await bulkProcessToTasks([...selectedUids], shared);
    // refresh inbox list
    await loadInboxItemsToStore(true);
    setSelectedUids(new Set());
};
```
`inboxService.ts`: adicione `bulkProcessToTasks`, `bulkDeleteInbox`, `bulkMarkProcessed` (fetch POST).

## 9. Testes — backend
`backend/tests/integration/inbox-bulk.test.js`:
- `POST /inbox/bulk` com `{ uids: [a,b], sharedTags: ['work'], sharedProjectUid: 'proj-1' }` → tasks criadas + items marcados processed; response `{ created: [a,b], failed: [] }`.
- `POST /inbox/bulk-delete` → items status='deleted'.
- `POST /inbox/bulk-mark-processed` → items status='processed' sem criar task.
- uid inexistente → failed.
- `uids: []` → 400.

## 10. Lint
```bash
cd backend && npx eslint --fix modules/inbox/routes.js modules/inbox/controller.js modules/inbox/service.js
cd frontend && npx eslint --fix components/Inbox/InboxItems.tsx components/Inbox/InboxItemDetail.tsx components/Inbox/InboxBulkToolbar.tsx utils/inboxService.ts
```

## Request / Response shapes
**POST /api/inbox/bulk**: `{ "uids": ["a","b"], "sharedTags": ["work"], "sharedProjectUid": "proj-1" }` → `{ "created": ["a","b"], "failed": [] }`.
**POST /api/inbox/bulk-delete**: `{ "uids": ["a"] }` → `{ "deleted": ["a"], "failed": [] }`.
**POST /api/inbox/bulk-mark-processed**: `{ "uids": ["a"] }` → `{ "processed": ["a"], "failed": [] }`.

## Critério de pronto
- [ ] 3 endpoints bulk (process-to-tasks / delete / mark-processed) atômicos (tx em inbox update).
- [ ] InboxItems com selection mode + checkboxes.
- [ ] InboxBulkToolbar flutuante; Delete pede confirm.
- [ ] "Process all as Task" abre sub-modal com tags/project comuns.
- [ ] Suítes verde; lint limpo.

## Commit
`feat(inbox): bulk process, delete, and mark-processed` — "Implements plans/69". Branch `feat/69-inbox-bulk`, sem merge/push.

## Fora de escopo
- AI auto-triage batch (não aprovado).
- Bulk add tag sem converter (não aprovado).
