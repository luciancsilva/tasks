# 65 — Inbox stale alert (>48h unprocessed)

> **Status: EXECUTADO** em 2026-07-19 — `countStale`/`getStaleCount` + `GET /inbox/stale-count`; sidebar ponto vermelho, banner na página Inbox e borda vermelha em items 'added' >48h (SWR refresh 60s). Threshold hard-coded 48h (campo User fora do escopo v1).
> **Status original: PROPOSTO** — Inbox items sem alerta de staleness. Item não-processado fica indefinidamente. Sem badge/banner.
> **Esforço:** Baixo · **Natureza:** julgamento baixo · **Modelo:** baixo
> **Branch:** `feat/65-inbox-stale-alert` a partir da `main` · **Depende de:** -

## Contexto

Refs:
- `inboxRepository.findAllActive` (`repository.js`) — status='added', order created_at DESC.
- `inboxStore.pagination.total` — count de items ativos (usado em `SidebarNav.tsx:35` para badge).
- `InboxItems.tsx` — lista + QuickCaptureInput (`:509`).
- `inbox_item.js:27` — `status` default 'added'.

Política: item 'added' com `created_at < agora - 48h` = stale. Threshold default 48h, configurável em `User.inbox_stale_hours` (opcional v1: hard-code 48). Badge no sidebar Inbox + banner na página Inbox.

## 1. Baseline
```bash
npm run backend:test && npm run frontend:test
```

## 2. Backend — count stale
`backend/modules/inbox/repository.js`: adicione:
```js
async countStale(userId, hoursThreshold = 48) {
    const cutoff = new Date(Date.now() - hoursThreshold * 3600000);
    return InboxItem.count({
        where: { user_id: userId, status: 'added', created_at: { [Op.lt]: cutoff } },
    });
}
```

## 3. Backend — endpoint
`backend/modules/inbox/routes.js` após `:9` (`GET /inbox`):
```js
router.get('/inbox/stale-count', inboxController.staleCount);
```
`backend/modules/inbox/controller.js`:
```js
async staleCount(req, res, next) {
    try {
        const userId = requireUserId(req);
        const count = await inboxRepository.countStale(userId);
        res.json({ stale_count: count });
    } catch (err) { next(err); }
}
```

## 4. User — threshold (opcional v1)
`backend/models/user.js`: `inbox_stale_hours: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 48, validate: { min: 1 } }`. Migration `20260718000014-add-inbox-stale-hours-to-users.js`. Opcional — v1 pode hard-code 48 no repository. Se implementar, `countStale(userId, user.inbox_stale_hours)`.

## 5. Frontend — sidebar badge
`SidebarNav.tsx` (`:35` `inboxItemsCount`): além do count total, fetch stale count via SWR e mostrar ponto vermelho se `stale_count > 0`:
```tsx
const { data: staleData } = useSWR('/api/inbox/stale-count', fetcher);
// no render do Inbox link:
{staleData?.stale_count > 0 && (
    <span className="h-2 w-2 rounded-full bg-red-500" title="Inbox has stale items (>48h)" />
)}
```

## 6. Frontend — Inbox page banner
`InboxItems.tsx`: no topo (após `QuickCaptureInput` `:509`), se `stale_count > 0`:
```tsx
{staleCount > 0 && (
    <div className="mb-4 p-3 rounded bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-200 text-sm flex items-center justify-between">
        <span>{t('inbox.staleWarning', '{{count}} items in inbox for over 48h — process them', { count: staleCount })}</span>
        <button onClick={() => {/* scroll to first stale ou filter */}} className="text-xs underline">{t('inbox.reviewNow', 'Review now')}</button>
    </div>
)}
```
Stale count via SWR `/api/inbox/stale-count`.

## 7. Frontend — destacar items stale na lista
`InboxItemDetail.tsx` (render `:903-934`): se `item.created_at` < agora-48h e status='added', borda vermelha ou ícone ⚠:
```tsx
const isStale = item.status === 'added' && (Date.now() - new Date(item.created_at).getTime()) > 48 * 3600000;
// className condicional: isStale ? 'border-red-400' : ''
```

## 8. Testes — backend
`backend/tests/integration/inbox-stale.test.js`:
- 3 items: 1 há 1h, 1 há 30h, 1 há 50h → `countStale` retorna 1.
- Threshold custom (se user.inbox_stale_hours=24) → 2 stale.

## 9. Lint
```bash
cd backend && npx eslint --fix modules/inbox/repository.js modules/inbox/routes.js modules/inbox/controller.js
cd frontend && npx eslint --fix components/Sidebar/SidebarNav.tsx components/Inbox/InboxItems.tsx components/Inbox/InboxItemDetail.tsx
```

## Request / Response shapes
**GET /api/inbox/stale-count**: `{ "stale_count": 3 }`.

## Critério de pronto
- [ ] `GET /inbox/stale-count` retorna count de items 'added' há >48h.
- [ ] Sidebar Inbox badge com ponto vermelho se stale.
- [ ] Inbox page banner com count + "Review now".
- [ ] Items stale destacados na lista (borda vermelha).
- [ ] Suítes verde; lint limpo.

## Commit
`feat(inbox): stale alert for unprocessed items over 48h` — "Implements plans/65". Branch `feat/65-inbox-stale-alert`, sem merge/push.

## Fora de escopo
- Notificação push de inbox stale (in-app banner basta v1).
- Auto-archive stale items.
- Threshold por user (v1 hard-code 48, opcional campo User).
