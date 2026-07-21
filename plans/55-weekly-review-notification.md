# 55 — Notificação `weekly_review` agendada

> **Status: EXECUTADO** em 2026-07-19 — Notification type `weekly_review` + pref `weeklyReview` (default in-app true) + campos User (`weekly_review_enabled`/`weekly_review_day`/`weekly_review_time`) + cron diário 16h (`weekly_review_daily`) com handler `processWeeklyReviewNotifications` filtrando por dia (tz do user) + `suggested`. Desvio do plano: `sources` não inclui `'in-app'` (validator do model só aceita telegram/mobile/email); in-app é implícito pela row existir, conforme padrão `dueTaskService`. Notification types (`notification.js:31-`) não incluem `weekly_review`. Cron `taskScheduler.js:55-68` não tem frequência para review. User sem lembrete externo.
>
> **Revisão de 2026-07-21:** o plano criava `weekly_review_time` e nunca o lia —
> o cron era fixo em `'0 16 * * *'` com `timezone: 'UTC'`, então o lembrete caía
> às 13h para quem está em `America/Sao_Paulo` e o campo era decorativo. A
> frequência virou `weekly_review_hourly` (`'0 * * * *'`) e o handler só dispara
> quando a hora local do usuário bate com `weekly_review_time` — continua 1x por
> semana, agora na hora certa. Também fixado `now.locale('en')` antes de
> `format('dddd')`: `weekly_review_day` guarda nomes em inglês, e um
> `moment.locale()` global em qualquer lugar do processo faria o filtro de dia
> parar de casar em silêncio. Teste novo: hora diferente da configurada → skip.
> **Esforço:** Baixo · **Natureza:** julgamento baixo · **Modelo:** baixo
> **Branch:** `feat/55-weekly-review-notification` a partir da `main` · **Depende de:** 54a (`last_reviewed_at`)

## Contexto

Weekly Review só funciona se user lembrar. Cron dispara notificação in-app + Telegram quando `days_since(last_reviewed_at) ≥ 7` (ou null). Não depender de `task_summary_enabled` (review é separado). Preferência dedicada `weeklyReview` em `notificationPreferences.js`.

## 1. Baseline
```bash
npm run backend:test && npm run frontend:test
```

## 2. Notification model — type
`backend/models/notification.js:31` (`type` isIn array): adicione `'weekly_review'` ao array. Não há migration (STRING + isIn, sem ENUM column).

## 3. Notification preferences — default
`backend/utils/notificationPreferences.js:6-15`: adicione:
```js
weeklyReview: { inApp: true, email: false, push: false, telegram: false },
```
`mergePreferences` (`:107-124`) já cobre novas keys via defaults fallback.

## 4. User — preferência de dia/horário + toggle
`backend/models/user.js`: adicione campos:
```js
weekly_review_enabled: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
weekly_review_day: { type: DataTypes.STRING, allowNull: false, defaultValue: 'friday',
    validate: { isIn: [['sunday','monday','tuesday','wednesday','thursday','friday','saturday']] } },
weekly_review_time: { type: DataTypes.STRING, allowNull: false, defaultValue: '16:00' },
```
Migration `backend/migrations/20260718000009-add-weekly-review-prefs-to-users.js`:
```js
'use strict';
const { SAFE_ADD_COLUMNS } = require('../shared/migration-helpers');
module.exports = {
    async up(queryInterface, Sequelize) {
        await SAFE_ADD_COLUMNS(queryInterface, 'users', [
            { column: 'weekly_review_enabled', type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
            { column: 'weekly_review_day', type: Sequelize.STRING, allowNull: false, defaultValue: 'friday' },
            { column: 'weekly_review_time', type: Sequelize.STRING, allowNull: false, defaultValue: '16:00' },
        ]);
    },
    async down(queryInterface, Sequelize) {
        for (const c of ['weekly_review_enabled','weekly_review_day','weekly_review_time']) {
            try { await queryInterface.removeColumn('users', c); } catch (e) {}
        }
    },
};
```

## 5. Cron — `backend/modules/tasks/taskScheduler.js`

### 5a. `getCronExpression` (`:22-38`)
Adicione:
```js
weekly_review_daily: '0 16 * * *',
```
Cron diário 16h UTC; handler filtra users cujo `weekly_review_day` == hoje (no fuso do user).

### 5b. `createJobHandler` (`:40-52`)
Adicione branch:
```js
} else if (frequency === 'weekly_review_daily') {
    await processWeeklyReviewNotifications();
}
```

### 5c. `createJobEntries` (`:54-78`)
Adicione `'weekly_review_daily'` ao array `frequencies` (`:55-68`).

### 5d. Handler
Preferido: service dedicado `backend/modules/reviews/reviewNotificationService.js` (manter scheduler thin):
```js
'use strict';
const moment = require('moment-timezone');
const { User, Notification } = require('../../models');
const reviewsService = require('./service');
const { shouldSendTelegramNotification } = require('../../utils/notificationPreferences');
const telegramNotificationService = require('../telegram/telegramNotificationService');

async function processWeeklyReviewNotifications() {
    const users = await User.findAll({
        where: { weekly_review_enabled: true },
        attributes: ['id', 'timezone', 'weekly_review_day', 'weekly_review_time', 'telegram_bot_token', 'telegram_chat_id', 'notification_preferences'],
    });
    for (const user of users) {
        const tz = user.timezone || 'UTC';
        const now = moment.tz(tz);
        const todayName = now.format('dddd').toLowerCase();
        if (user.weekly_review_day !== todayName) continue;
        const status = await reviewsService.getStatus(user.id);
        if (!status.suggested) continue; // days_since < 7
        const sources = ['in-app'];
        if (shouldSendTelegramNotification(user, 'weekly_review') && user.telegram_bot_token && user.telegram_chat_id) {
            sources.push('telegram');
        }
        const notif = await Notification.createNotification({
            userId: user.id,
            type: 'weekly_review',
            level: 'info',
            title: 'Weekly Review due',
            message: `It's been ${status.days_since ?? '∞'} days since your last review.`,
            sources,
            data: { days_since: status.days_since, last_reviewed_at: status.last_reviewed_at },
            sentAt: new Date(),
        });
        // Telegram send já é feito dentro de Notification.createNotification se sources inclui 'telegram'
    }
}

module.exports = { processWeeklyReviewNotifications };
```
`Notification.createNotification` (`notification.js:141-180`) já envia Telegram se `sources.includes('telegram')` (`:168`).

No `taskScheduler.js`, importe e chame:
```js
const { processWeeklyReviewNotifications } = require('../reviews/reviewNotificationService');
```

## 6. i18n notif
Titles/messages: i18n server-side? Hoje `notification.js` usa strings diretas (ver `dueTaskService.js`). Para PT/EN, seguir padrão existente (provavelmente hard-coded EN ou i18n via user.locale se disponível). Confira `dueTaskService.js:162-177` para o padrão. Se i18n server existe, use; senão EN hard-coded (aceitável v1).

## 7. Frontend — Profile tab (opcional v1)
`frontend/components/Profile/tabs/NotificationsTab.tsx`: adicione toggle "Weekly Review" + select de dia + input time. Opcional — v1 pode usar defaults (sexta 16h). Se implementar, PATCH `/api/profile` com `weekly_review_enabled`, `weekly_review_day`, `weekly_review_time`.

## 8. Testes — backend
`backend/tests/integration/weekly-review-notification.test.js`:
- Notification type `weekly_review` aceito (create não rejeita).
- Handler com fixture: user `weekly_review_day='friday'`, `last_reviewed_at` há 10 dias → recebe notif; há 2 dias → skip.
- User com `weekly_review_enabled=false` → skip.
- User sem telegram → só in-app (Notification row criada, sem sendTelegram).
- User com `weekly_review_day='monday'` e hoje é friday → skip.
- `notificationPreferences.shouldSendTelegramNotification(user, 'weekly_review')` respeite pref (default false).

## 9. Lint
```bash
cd backend && npx eslint --fix models/notification.js models/user.js utils/notificationPreferences.js modules/tasks/taskScheduler.js modules/reviews/reviewNotificationService.js migrations/20260718000009-add-weekly-review-prefs-to-users.js
cd frontend && npx eslint --fix components/Profile/tabs/NotificationsTab.tsx
```

## Request / Response shapes
**POST /api/profile** (opcional): `{ "weekly_review_enabled": true, "weekly_review_day": "friday", "weekly_review_time": "16:00" }`.
Notification row: `{ "type": "weekly_review", "level": "info", "title": "Weekly Review due", "data": { "days_since": 10 } }`.

## Critério de pronto
- [ ] Notification type `weekly_review` válido.
- [ ] Preference `weeklyReview` default (in-app true, telegram false).
- [ ] Cron diário 16h dispara handler; filtra users por `weekly_review_day` + `weekly_review_enabled` + `suggested`.
- [ ] Notification row criada; Telegram enviado se pref+creds.
- [ ] Suítes verde; lint limpo.

## Commit
`feat(reviews): scheduled weekly_review notification with prefs` — "Implements plans/55". Branch `feat/55-weekly-review-notification`, sem merge/push.

## Fora de escopo
- UI fina de dia/hora (Profile tab — opcional v1 usa defaults).
- Reminder escalation.
- Email channel (defaults false; envio real é plano futuro).
