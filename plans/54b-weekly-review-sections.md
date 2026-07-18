# 54b — Weekly Review: seções (inbox zero, stale, stalled, waiting, someday, goals, upcoming)

> **Status: PROPOSTO** — 54a cria shell. Este plano implementa agregação de dados das 7 seções do checklist GTD.
> **Esforço:** Alto · **Natureza:** julgamento médio · **Modelo:** médio
> **Branch:** `feat/54-weekly-review` · **Depende de:** 54a, 56

## Contexto

Seções GTD Weekly Review (Allen):
1. **Inbox zero** — items não-processados.
2. **Stale tasks** — não-done, não atualizadas há >N dias (plano 56).
3. **Stalled projects** — `in_progress`/`planned` com zero active tasks (`projects/service.js:172-175`).
4. **Waiting follow-up** — `status=waiting` + `waiting_since` antiga (plano 50).
5. **Someday sweep** — `is_someday=true` (plano 49).
6. **Goals progress** — goals active + projetos vinculados + completion %.
7. **Upcoming 7d** — tasks due em 7 dias (`type=upcoming`).

Cada seção: título + count + lista navegável (click → abre página relevante).

## 1. Baseline
```bash
npm run backend:test && npm run frontend:test
```
Confirmar 54a + 56 na branch.

## 2. Service — agregação — `backend/modules/reviews/service.js`

Substituir `getSections` (shell de 54a) por implementação real. Reusar módulos existentes (não duplicar SQL):

```js
const { InboxItem, Task, Project, Goal } = require('../../models');
const inboxRepository = require('../inbox/repository');
const projectsService = require('../projects/service');
const goalsService = require('../goals/service');
const { Op } = require('sequelize');

async getSections(userId, tz) {
    const sections = [];

    // 1. Inbox zero
    const inboxCount = await inboxRepository.countActive(userId);
    sections.push({
        id: 'inbox', title_key: 'review.section.inbox', count: inboxCount, ready: true,
        items: [], href: '/inbox',
    });

    // 2. Stale tasks (plano 56)
    const staleDays = await this._getUserStaleDays(userId);
    const staleTasks = await this._findStaleTasks(userId, staleDays);
    sections.push({
        id: 'stale', title_key: 'review.section.stale', count: staleTasks.length, ready: true,
        items: staleTasks.slice(0, 20).map(t => ({ uid: t.uid, name: t.name, type: 'task', href: `/task/${t.uid}`, meta: { days_stale: Math.floor((Date.now() - new Date(t.updated_at).getTime()) / 86400000) } })),
        href: '/tasks?type=stale&stale_days=' + staleDays,
    });

    // 3. Stalled projects
    const allProjects = await projectsService.getAll(userId, { status: 'active' });
    const stalled = allProjects.filter(p => p.is_stalled);
    sections.push({
        id: 'stalled', title_key: 'review.section.stalled', count: stalled.length, ready: true,
        items: stalled.slice(0, 20).map(p => ({ uid: p.uid, name: p.name, type: 'project', href: `/project/${p.uid}` })),
    });

    // 4. Waiting follow-up
    const waitingTasks = await Task.findAll({
        where: { user_id: userId, status: 4 },
        order: [['waiting_since', 'ASC']],
    });
    const followUpOverdue = waitingTasks.filter(t => t.waiting_since && (Date.now() - new Date(t.waiting_since).getTime()) >= 7 * 86400000);
    sections.push({
        id: 'waiting', title_key: 'review.section.waiting', count: waitingTasks.length, ready: true,
        items: waitingTasks.slice(0, 20).map(t => ({
            uid: t.uid, name: t.name, type: 'task', href: `/task/${t.uid}`,
            meta: { waiting_since_days: t.waiting_since ? Math.floor((Date.now() - new Date(t.waiting_since).getTime()) / 86400000) : null },
        })),
        follow_up_overdue_count: followUpOverdue.length,
        href: '/tasks?type=waiting',
    });

    // 5. Someday sweep
    const somedayTasks = await Task.findAll({
        where: { user_id: userId, is_someday: true, status: { [Op.notIn]: [2, 3, 5] } },
        order: [['updated_at', 'ASC']],
    });
    sections.push({
        id: 'someday', title_key: 'review.section.someday', count: somedayTasks.length, ready: true,
        items: somedayTasks.slice(0, 20).map(t => ({ uid: t.uid, name: t.name, type: 'task', href: `/task/${t.uid}` })),
        href: '/tasks?type=someday',
    });

    // 6. Goals progress
    const goals = await goalsService.getAll(userId);
    const activeGoals = goals.filter(g => g.status === 'active');
    sections.push({
        id: 'goals', title_key: 'review.section.goals', count: activeGoals.length, ready: true,
        items: activeGoals.slice(0, 20).map(g => ({
            uid: g.uid, name: g.title, type: 'goal', href: `/area/${g.area_uid || ''}`,
            meta: { horizon: g.horizon, target_date: g.target_date },
        })),
    });

    // 7. Upcoming 7d
    const now = new Date();
    const in7d = new Date(now.getTime() + 7 * 86400000);
    const upcomingTasks = await Task.findAll({
        where: { user_id: userId, due_date: { [Op.between]: [now, in7d] }, status: { [Op.notIn]: [2, 3, 5] }, is_someday: { [Op.ne]: true } },
        order: [['due_date', 'ASC']],
    });
    sections.push({
        id: 'upcoming', title_key: 'review.section.upcoming', count: upcomingTasks.length, ready: true,
        items: upcomingTasks.slice(0, 20).map(t => ({ uid: t.uid, name: t.name, type: 'task', href: `/task/${t.uid}`, meta: { due_date: t.due_date } })),
        href: '/upcoming',
    });

    return sections;
}
```

### Helpers privados
```js
async _getUserStaleDays(userId) {
    const user = await User.findByPk(userId, { attributes: ['stale_task_days'] });
    return user?.stale_task_days || 30;
}

async _findStaleTasks(userId, days) {
    const cutoff = new Date(Date.now() - days * 86400000);
    return Task.findAll({
        where: {
            user_id: userId,
            updated_at: { [Op.lt]: cutoff },
            status: { [Op.notIn]: [2, 3, 5] },
            recurring_parent_id: null,
            is_someday: { [Op.ne]: true },
            habit_mode: { [Op.ne]: true },
        },
        order: [['updated_at', 'ASC']],
        limit: 50,
    });
}
```
Se plano 56 estiver executado, `_findStaleTasks` pode chamar `filterTasksByParams({type:'stale', stale_days: days})` via `tasksService.list` — mas chamar direto é mais simples e evita circular deps.

## 3. Frontend — `ReviewSection.tsx` + `ReviewItemRow.tsx`

### 3a. `ReviewItemRow.tsx`
```tsx
interface ReviewItemRowProps {
    item: { uid: string; name: string; type: string; href: string; meta?: Record<string, any> };
}
const ReviewItemRow: React.FC<ReviewItemRowProps> = ({ item }) => {
    const navigate = useNavigate();
    return (
        <button onClick={() => navigate(item.href)} className="w-full text-left p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded flex items-center justify-between">
            <span className="truncate">{item.name}</span>
            {item.meta?.days_stale != null && <span className="text-xs text-red-500">{item.meta.days_stale}d</span>}
            {item.meta?.waiting_since_days != null && <span className="text-xs text-amber-500">{item.meta.waiting_since_days}d</span>}
        </button>
    );
};
```

### 3b. `ReviewSection.tsx` (atualizar shell de 54a)
Renderizar items quando `ready: true`:
```tsx
{section.ready && section.items.length > 0 && (
    <div className="mt-2 space-y-1">
        {section.items.map(item => <ReviewItemRow key={item.uid} item={item} />)}
    </div>
)}
{section.ready && section.items.length === 0 && (
    <p className="text-sm text-gray-400 mt-2">{t('review.empty', 'All clear')}</p>
)}
{section.href && (
    <button onClick={() => navigate(section.href)} className="text-xs text-blue-500 mt-2">{t('review.openFull', 'Open full list')}</button>
)}
```

## 4. i18n
Chaves em `frontend/i18n/locales/*/review.json` (PT/EN):
```json
{
  "section.inbox": "Inbox zero",
  "section.stale": "Stale tasks",
  "section.stalled": "Stalled projects",
  "section.waiting": "Waiting follow-up",
  "section.someday": "Someday/Maybe sweep",
  "section.goals": "Goals progress",
  "section.upcoming": "Upcoming 7 days",
  "empty": "Tudo em dia",
  "openFull": "Abrir lista completa"
}
```

## 5. Testes — backend
`backend/tests/integration/reviews-sections.test.js`:
- `getSections` retorna 7 seções; `ready: true`.
- Inbox com 3 items → section inbox `count: 3`.
- Stale: fixture task updated há 40 dias → em stale; há 10 dias → não.
- Stalled: projeto in_progress com 0 active tasks → em stalled.
- Waiting: task waiting há 10 dias → em waiting (`waiting_since_days: 10`).
- Someday: task `is_someday=true` → em someday.
- Goals: goal active → em goals.
- Upcoming: task due em 3 dias → em upcoming; due em 10 dias → não.

## 6. Lint
```bash
cd backend && npx eslint --fix modules/reviews/service.js
cd frontend && npx eslint --fix components/Review/WeeklyReview.tsx components/Review/ReviewSection.tsx components/Review/ReviewItemRow.tsx
```

## Request / Response shapes
**GET /api/reviews/sections** (54b completo):
```json
{ "sections": [
  { "id": "inbox", "title_key": "review.section.inbox", "count": 3, "ready": true, "items": [], "href": "/inbox" },
  { "id": "stale", "title_key": "review.section.stale", "count": 5, "ready": true, "items": [{ "uid": "abc", "name": "Ligar cliente", "type": "task", "href": "/task/abc", "meta": { "days_stale": 42 } }], "href": "/tasks?type=stale&stale_days=30" },
  ...
]}
```

## Critério de pronto
- [ ] `GET /reviews/sections` retorna 7 seções com counts + items.
- [ ] Cada seção reusa queries existentes (inbox/stalled/waiting/someday/upcoming via services/models).
- [ ] Frontend renderiza seções com badges + checklist + navegação.
- [ ] "Mark complete" (54a) reset checkboxes.
- [ ] Suítes verde; lint limpo.

## Commit
`feat(reviews): weekly review sections aggregation and UI` — "Implements plans/54b". Branch `feat/54-weekly-review`.

## Fora de escopo
- Auto-promote Someday→action (só lista para user decidir).
- AI-generated review summary.
- Histórico de reviews passados.
