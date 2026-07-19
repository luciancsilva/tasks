# 54a — Weekly Review: rota + checklist + `last_reviewed_at`

> **Status: EXECUTADO** em 2026-07-19 — Módulo `reviews` montado (rotas `/reviews/status`, `/reviews/complete`, `/reviews/sections`), migration `last_reviewed_at` em User, rota `/review` com shell + checklist, sidebar entry. Seções (dados) ficam para 54b. Sem rota, sem component, sem checklist, sem `last_reviewed_at`. GTD passo "Refletir" depende 100% de disciplina manual + 3 hábitos (`docs/17-gtd-setup.md:73-91`). Este plano cria a infraestrutura: rota `/review`, módulo backend `reviews`, checklist shell, timestamp em User. Seções em 54b.
> **Esforço:** Alto · **Natureza:** julgamento médio · **Modelo:** médio
> **Branch:** `feat/54-weekly-review` a partir da `main` · **Depende de:** -

## Contexto

Weekly Review GTD = "get current" semanal: inbox zero, stale tasks, stalled projects, waiting follow-up, someday sweep, goals progress, upcoming 7d. Hoje usuário varre manualmente várias páginas. Plano cria hub único `/review` com checklist guiado + `last_reviewed_at` em User. Seções (dados) em 54b.

## 1. Baseline
```bash
npm run backend:test && npm run frontend:test
```

## 2. Migration — User.last_reviewed_at
`backend/migrations/20260718000008-add-last-reviewed-at-to-users.js`:
```js
'use strict';
const { SAFE_ADD_COLUMNS } = require('../shared/migration-helpers');
module.exports = {
    async up(queryInterface, Sequelize) {
        await SAFE_ADD_COLUMNS(queryInterface, 'users', [
            { column: 'last_reviewed_at', type: Sequelize.DATE, allowNull: true, defaultValue: null },
        ]);
    },
    async down(queryInterface) { try { await queryInterface.removeColumn('users', 'last_reviewed_at'); } catch (e) {} },
};
```

## 3. Model — `backend/models/user.js`
Após `ai_daily_brief_date` (~linha 240):
```js
last_reviewed_at: {
    type: DataTypes.DATE,
    allowNull: true,
    defaultValue: null,
},
```

## 4. Novo módulo backend `reviews`
Estrutura padrão do fork (`docs/backend-patterns.md`). Template: `backend/modules/people/` (index.js, routes.js, controller.js, service.js, repository.js).

### 4a. `backend/modules/reviews/index.js`
```js
'use strict';
const routes = require('./routes');
const reviewsService = require('./service');
const reviewsRepository = require('./repository');
module.exports = { routes, reviewsService, reviewsRepository };
```

### 4b. `backend/modules/reviews/routes.js`
```js
'use strict';
const express = require('express');
const router = express.Router();
const reviewsController = require('./controller');

router.get('/reviews/status', reviewsController.getStatus);
router.post('/reviews/complete', reviewsController.markComplete);
router.get('/reviews/sections', reviewsController.getSections);

module.exports = router;
```

### 4c. `backend/modules/reviews/controller.js`
```js
'use strict';
const reviewsService = require('./service');
const { requireUserId } = require('../../shared/auth-helpers');

async function getStatus(req, res, next) {
    try {
        const userId = requireUserId(req);
        const status = await reviewsService.getStatus(userId);
        res.json(status);
    } catch (err) { next(err); }
}

async function markComplete(req, res, next) {
    try {
        const userId = requireUserId(req);
        const updated = await reviewsService.markComplete(userId);
        res.json(updated);
    } catch (err) { next(err); }
}

async function getSections(req, res, next) {
    try {
        const userId = requireUserId(req);
        const tz = req.currentUser?.timezone || 'UTC';
        const sections = await reviewsService.getSections(userId, tz);
        res.json({ sections });
    } catch (err) { next(err); }
}

module.exports = { getStatus, markComplete, getSections };
```
Valide `requireUserId` em `backend/shared/auth-helpers.js` (confirmar nome exato — people module usa `requireUserId(req)` em `controller.js:7-11`).

### 4d. `backend/modules/reviews/service.js`
```js
'use strict';
const moment = require('moment-timezone');
const { User } = require('../../models');
const reviewsRepository = require('./repository');

class ReviewsService {
    async getStatus(userId) {
        const user = await User.findByPk(userId, { attributes: ['id', 'last_reviewed_at', 'timezone'] });
        if (!user) throw new NotFoundError('User not found');
        const tz = user.timezone || 'UTC';
        const now = moment.tz(tz);
        const last = user.last_reviewed_at ? moment.tz(user.last_reviewed_at, tz) : null;
        const daysSince = last ? now.diff(last.startOf('day'), 'days') : null;
        const suggested = daysSince === null || daysSince >= 7;
        return {
            last_reviewed_at: user.last_reviewed_at,
            days_since: daysSince,
            suggested,
        };
    }

    async markComplete(userId) {
        const [updated] = await User.update(
            { last_reviewed_at: new Date() },
            { where: { id: userId } }
        );
        if (updated === 0) throw new NotFoundError('User not found');
        return this.getStatus(userId);
    }

    async getSections(userId, tz) {
        // 54b implementa agregação. 54a retorna shell.
        return [
            { id: 'inbox', title_key: 'review.section.inbox', count: null, items: [], ready: false },
            { id: 'stale', title_key: 'review.section.stale', count: null, items: [], ready: false },
            { id: 'stalled', title_key: 'review.section.stalled', count: null, items: [], ready: false },
            { id: 'waiting', title_key: 'review.section.waiting', count: null, items: [], ready: false },
            { id: 'someday', title_key: 'review.section.someday', count: null, items: [], ready: false },
            { id: 'goals', title_key: 'review.section.goals', count: null, items: [], ready: false },
            { id: 'upcoming', title_key: 'review.section.upcoming', count: null, items: [], ready: false },
        ];
    }
}

const { NotFoundError } = require('../../shared/errors');
module.exports = new ReviewsService();
```

### 4e. `backend/modules/reviews/repository.js`
```js
'use strict';
const { User } = require('../../models');

class ReviewsRepository {
    async getUserWithReviewState(userId) {
        return User.findByPk(userId, { attributes: ['id', 'last_reviewed_at', 'timezone'] });
    }
    async setLastReviewed(userId, date) {
        return User.update({ last_reviewed_at: date }, { where: { id: userId } });
    }
}

module.exports = new ReviewsRepository();
```

### 4f. `backend/modules/reviews/validation.js`
Vazio por ora (sem input validation necessária em 54a).

## 5. app.js — mount
`backend/app.js` no bloco de módulos (`:386-407`), após `aiAssistantModule` (`:405`):
```js
const reviewsModule = require('./modules/reviews');
app.use(basePath, reviewsModule.routes);
```
Confirmar que está **após** `requireAuth` (`:384`).

## 6. Frontend — rota — `frontend/App.tsx`
Em `:191-345`, adicione após `/upcoming` (~linha 231):
```tsx
<Route path="/review" element={<WeeklyReview />} />
```
Importe `WeeklyReview` de `./components/Review/WeeklyReview` (lazy opcional).

## 7. Frontend — componente shell
Crie `frontend/components/Review/WeeklyReview.tsx`:
```tsx
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import useSWR from 'swr';
import { fetchReviewsStatus, fetchReviewsSections, markReviewComplete } from '../../utils/reviewsService';
import { useToast } from '../Shared/ToastContext';
import ReviewSection from './ReviewSection';

const WeeklyReview: React.FC = () => {
    const { t } = useTranslation();
    const { toast } = useToast();
    const { data: status, mutate: mutateStatus } = useSWR('/api/reviews/status', fetchReviewsStatus);
    const { data: sectionsData, mutate: mutateSections } = useSWR('/api/reviews/sections', fetchReviewsSections);
    const [checklist, setChecklist] = useState<Record<string, boolean>>({});

    const handleComplete = async () => {
        await markReviewComplete();
        await mutateStatus();
        setChecklist({});
        toast({ message: t('review.completed', 'Weekly review marked complete'), type: 'success' });
    };

    const toggleSection = (id: string) => setChecklist(prev => ({ ...prev, [id]: !prev[id] }));

    return (
        <div className="max-w-4xl mx-auto p-4">
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold">{t('review.title', 'Weekly Review')}</h1>
                <div className="flex items-center gap-3">
                    {status?.last_reviewed_at && (
                        <span className="text-sm text-gray-500">
                            {t('review.lastCompleted', 'Last:')} {new Date(status.last_reviewed_at).toLocaleDateString()}
                        </span>
                    )}
                    {status?.suggested && (
                        <span className="px-2 py-1 text-xs rounded bg-amber-100 text-amber-700">{t('review.due', 'Due')}</span>
                    )}
                    <button onClick={handleComplete} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                        {t('review.markComplete', 'Mark complete')}
                    </button>
                </div>
            </div>
            <div className="space-y-4">
                {(sectionsData?.sections || []).map(section => (
                    <ReviewSection
                        key={section.id}
                        section={section}
                        checked={!!checklist[section.id]}
                        onToggle={() => toggleSection(section.id)}
                    />
                ))}
            </div>
        </div>
    );
};
export default WeeklyReview;
```

### 7a. `ReviewSection.tsx`
```tsx
interface ReviewSectionProps {
    section: { id: string; title_key: string; count: number | null; items: any[]; ready: boolean };
    checked: boolean;
    onToggle: () => void;
}
```
Renderiza card expansível: header com checkbox + título + count badge (vermelho se >0 para inbox/stale/stalled/waiting; neutro para someday/goals/upcoming) + lista de items (em 54b `ready:true`).

## 8. Frontend — service
Crie `frontend/utils/reviewsService.ts`:
```ts
import { fetcher } from './fetcher';

export async function fetchReviewsStatus() {
    return fetcher('/api/reviews/status');
}
export async function fetchReviewsSections() {
    return fetcher('/api/reviews/sections');
}
export async function markReviewComplete() {
    const res = await fetch('/api/reviews/complete', { method: 'POST', credentials: 'include' });
    if (!res.ok) throw new Error('Failed to mark complete');
    return res.json();
}
```
Confirme o shape do `fetcher` em `frontend/utils/fetcher.ts` (espelhe `aiAssistantService.ts`).

## 9. Frontend — sidebar entry — `SidebarNav.tsx`
Adicione após Upcoming (`:53-57`):
```tsx
{
    path: '/review',
    title: t('sidebar.weeklyReview', 'Weekly Review'),
    icon: <ClipboardDocumentCheckIcon className="h-5 w-5" />,
},
```
Importe `ClipboardDocumentCheckIcon` de `@heroicons/react/24/solid`.
Badge condicional se `suggested` (days_since ≥ 7): ponto vermelho. Para isso, `SidebarNav` precisaria do status — fetch leve via SWR ou props do Layout. Simplificação v1: sem badge dinâmico (apenas ícone). Badge fica para 55 (notif) ou refinamento.

## 10. Testes — backend
`backend/tests/integration/reviews-status.test.js`:
- `GET /reviews/status` user sem review → `{ last_reviewed_at: null, days_since: null, suggested: true }`.
- `POST /reviews/complete` seta `last_reviewed_at` ≈ now; `GET /reviews/status` → `days_since: 0, suggested: false`.
- `days_since` respeita fuso do user (fixture user timezone UTC-12, `last_reviewed_at` há 6h → 0 dias).
- `GET /reviews/sections` retorna 7 seções com `ready: false` (shell).
- Auth: rota requer `requireAuth` (montada após `:384`).

## 11. Lint
```bash
cd backend && npx eslint --fix models/user.js modules/reviews/index.js modules/reviews/routes.js modules/reviews/controller.js modules/reviews/service.js modules/reviews/repository.js app.js migrations/20260718000008-add-last-reviewed-at-to-users.js
cd frontend && npx eslint --fix components/Review/WeeklyReview.tsx components/Review/ReviewSection.tsx utils/reviewsService.ts components/Sidebar/SidebarNav.tsx App.tsx
```

## Request / Response shapes
**GET /api/reviews/status**:
```json
{ "last_reviewed_at": "2026-07-11T16:00:00Z", "days_since": 7, "suggested": true }
```
**POST /api/reviews/complete** → mesma shape com `last_reviewed_at` atualizado, `days_since: 0`.
**GET /api/reviews/sections** (54a shell):
```json
{ "sections": [ { "id": "inbox", "title_key": "review.section.inbox", "count": null, "items": [], "ready": false }, ... ] }
```

## Critério de pronto
- [ ] Módulo `reviews` montado; rotas `/reviews/status`, `/reviews/complete`, `/reviews/sections` funcionam.
- [ ] `User.last_reviewed_at` persiste; `days_since` tz-aware.
- [ ] Rota `/review` renderiza shell com header + checklist skeleton.
- [ ] "Mark complete" seta timestamp.
- [ ] Sidebar tem entrada "Weekly Review".
- [ ] Suítes verde; lint limpo.

## Commit
`feat(reviews): weekly review route, status, and last_reviewed_at` — "Implements plans/54a". Branch `feat/54-weekly-review`, sem merge/push.

## Fora de escopo
- Conteúdo das seções (plano 54b).
- Notificação agendada (plano 55).
- Stale task query (plano 56, consumido por 54b).
