# 67a — Task comments (backend: model + module + notif)

> **Status: EXECUTADO** em 2026-07-19 — migration `comments` + model + módulo
> CRUD com access rw/ro + notif `comment_added` para o owner. **Fix 2026-07-20:**
> `requireUserId` lançava `Error('Unauthorized')` genérico (mapeado p/ 500);
> passou a lançar `UnauthorizedError` (401). Rotas montam atrás de `requireAuth`,
> então é defesa em profundidade.

> **Status: PROPOSTO** — Sem comments em tasks. Notification type `comment_added` JÁ EXISTE no enum (`notification.js:37`) mas nunca é produzido. Decisão aprovada: plain text + edit/delete flat, sem @mention, rw comenta/ro lê.
> **Esforço:** Médio · **Natureza:** julgamento baixo · **Modelo:** médio
> **Branch:** `feat/67-task-comments` a partir da `main` · **Depende de:** -

## Contexto

Refs:
- `backend/modules/people/` template de módulo (index/routes/controller/service/repository).
- `backend/models/notification.js:37` `comment_added` no enum (nunca usado).
- `Notification.createNotification` `:141-180` — shape + Telegram send.
- `permissionsService.getAccess(userId, 'task', uid)` (`permissionsService.js:29-55`) — rw=can comment, ro=read.
- `requireTaskWriteAccess` (`tasks/middleware/access.js:12`) template.

## 1. Baseline
```bash
npm run backend:test && npm run frontend:test
```

## 2. Migration
`backend/migrations/20260718000015-create-comments.js`:
```js
'use strict';
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('comments', {
            id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
            uid: { type: Sequelize.STRING, unique: true, allowNull: false },
            task_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'tasks', key: 'id' }, onDelete: 'CASCADE' },
            user_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'users', key: 'id' } },
            content: { type: Sequelize.TEXT, allowNull: false },
            created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
            updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
        });
        await queryInterface.addIndex('comments', ['task_id']);
    },
    async down(queryInterface) { await queryInterface.dropTable('comments'); },
};
```

## 3. Model — `backend/models/comment.js`
```js
'use strict';
const { DataTypes } = require('sequelize');
const { sequelize } = require('../database');
const { uid } = require('../shared/uid');

const Comment = sequelize.define('Comment', {
    uid: { type: DataTypes.STRING, unique: true, defaultValue: uid },
    task_id: { type: DataTypes.INTEGER, allowNull: false },
    user_id: { type: DataTypes.INTEGER, allowNull: false },
    content: { type: DataTypes.TEXT, allowNull: false, validate: { notEmpty: true } },
}, { tableName: 'comments', underscored: true });

module.exports = Comment;
```
Registre em `backend/models/index.js` (espelhe registro de `Person` ~`:329`). Associações:
```js
Comment.belongsTo(Task, { foreignKey: 'task_id', onDelete: 'CASCADE' });
Comment.belongsTo(User, { foreignKey: 'user_id' });
Task.hasMany(Comment, { foreignKey: 'task_id', onDelete: 'CASCADE' });
```

## 4. Módulo `backend/modules/comments/`

### 4a. `index.js`
```js
'use strict';
const routes = require('./routes');
const commentsService = require('./service');
module.exports = { routes, commentsService };
```

### 4b. `routes.js`
```js
'use strict';
const express = require('express');
const router = express.Router();
const commentsController = require('./controller');
const { requireTaskReadAccess, requireTaskWriteAccess } = require('../tasks/middleware/access');

router.get('/task/:uid/comments', requireTaskReadAccess, commentsController.list);
router.post('/task/:uid/comments', requireTaskWriteAccess, commentsController.create);
router.patch('/comment/:uid', commentsController.update);
router.delete('/comment/:uid', commentsController.delete);

module.exports = router;
```
`PATCH/DELETE /comment/:uid` — access check no controller (autor deve ser o único a editar/deletar; OU rw no parent task). Decisão: autor edita/deleta próprio; rw pode deletar (moderação). Implementar: `update` requer `comment.user_id === userId`; `delete` requer autor OU rw no parent task.

### 4c. `controller.js`
```js
'use strict';
const commentsService = require('./service');
const { requireUserId } = require('../../shared/auth-helpers');

async function list(req, res, next) {
    try {
        const userId = requireUserId(req);
        const comments = await commentsService.list(userId, req.params.uid);
        res.json({ comments });
    } catch (err) { next(err); }
}

async function create(req, res, next) {
    try {
        const userId = requireUserId(req);
        const comment = await commentsService.create(userId, req.params.uid, req.body.content);
        res.status(201).json(comment);
    } catch (err) { next(err); }
}

async function update(req, res, next) {
    try {
        const userId = requireUserId(req);
        const comment = await commentsService.update(userId, req.params.uid, req.body.content);
        res.json(comment);
    } catch (err) { next(err); }
}

async function delete_(req, res, next) {
    try {
        const userId = requireUserId(req);
        await commentsService.delete(userId, req.params.uid);
        res.status(204).end();
    } catch (err) { next(err); }
}

module.exports = { list, create, update, delete: delete_ };
```

### 4d. `service.js`
```js
'use strict';
const { Comment, Task, User, Notification } = require('../../models');
const { NotFoundError, ForbiddenError, ValidationError } = require('../../shared/errors');
const permissionsService = require('../../services/permissionsService');

class CommentsService {
    async list(userId, taskUid) {
        const task = await Task.findOne({ where: { uid: taskUid } });
        if (!task) throw new NotFoundError('Task not found');
        const access = await permissionsService.getAccess(userId, 'task', taskUid);
        if (access === 'none') throw new ForbiddenError('No access');
        return Comment.findAll({
            where: { task_id: task.id },
            include: [{ model: User, attributes: ['id', 'name', 'email'] }],
            order: [['created_at', 'ASC']],
        });
    }

    async create(userId, taskUid, content) {
        if (!content || !content.trim()) throw new ValidationError('Content required');
        const task = await Task.findOne({ where: { uid: taskUid } });
        if (!task) throw new NotFoundError('Task not found');
        const access = await permissionsService.getAccess(userId, 'task', taskUid);
        if (access !== 'rw' && task.user_id !== userId) throw new ForbiddenError('Write access required');
        const comment = await Comment.create({ task_id: task.id, user_id: userId, content: content.trim() });
        // Notif comment_added para task owner (se não for o autor)
        if (task.user_id !== userId) {
            await Notification.createNotification({
                userId: task.user_id, type: 'comment_added', level: 'info',
                title: 'New comment on task', message: content.trim().slice(0, 100),
                sources: ['in-app'], data: { taskUid, taskName: task.name, commentUid: comment.uid, authorId: userId },
                sentAt: new Date(),
            });
        }
        return comment;
    }

    async update(userId, commentUid, content) {
        if (!content || !content.trim()) throw new ValidationError('Content required');
        const comment = await Comment.findOne({ where: { uid: commentUid } });
        if (!comment) throw new NotFoundError('Comment not found');
        if (comment.user_id !== userId) throw new ForbiddenError('Only author can edit');
        await comment.update({ content: content.trim() });
        return comment;
    }

    async delete(userId, commentUid) {
        const comment = await Comment.findOne({ where: { uid: commentUid } });
        if (!comment) throw new NotFoundError('Comment not found');
        if (comment.user_id !== userId) {
            // verificar rw no parent task
            const task = await Task.findByPk(comment.task_id);
            const access = await permissionsService.getAccess(userId, 'task', task.uid);
            if (access !== 'rw' && task.user_id !== userId) throw new ForbiddenError('Cannot delete');
        }
        await comment.destroy();
    }
}

module.exports = new CommentsService();
```

### 4e. `repository.js` (opcional — service já usa model direto; manter thin para consistência)
```js
'use strict';
const { Comment } = require('../../models');
class CommentsRepository {
    async findByTaskId(taskId) { return Comment.findAll({ where: { task_id: taskId }, order: [['created_at','ASC']] }); }
    async create(data) { return Comment.create(data); }
    async findByUid(uid) { return Comment.findOne({ where: { uid } }); }
    async delete(comment) { return comment.destroy(); }
}
module.exports = new CommentsRepository();
```

## 5. app.js — mount
`backend/app.js` após `peopleModule` (`:406`) ou `templatesModule` (`:407`):
```js
const commentsModule = require('./modules/comments');
app.use(basePath, commentsModule.routes);
```

## 6. Serializer
Comment response já inclui `User` via include. Garantir `uid`, `content`, `created_at`, `updated_at`, `user: {id, name, email}`.

## 7. TaskEvent (opcional)
Logar `comment_added` em TaskEvent? `event_type` enum (`task_event.js:33-59`) não tem `comment_added`. Opcional — pular v1 (Notification já cobre alerta).

## 8. Testes — backend
`backend/tests/integration/comments.test.js`:
- `POST /task/:uid/comments` com content → 201, comment criado; notif `comment_added` criada para task owner (se autor ≠ owner).
- `GET /task/:uid/comments` → lista ordenada ASC por created_at.
- `PATCH /comment/:uid` por autor → ok; por não-autor → 403.
- `DELETE /comment/:uid` por autor → 204; por rw do parent → 204; por ro → 403.
- Task inexistente → 404.
- Content vazio → 400.

## 9. Lint
```bash
cd backend && npx eslint --fix models/comment.js models/index.js modules/comments/index.js modules/comments/routes.js modules/comments/controller.js modules/comments/service.js modules/comments/repository.js app.js migrations/20260718000015-create-comments.js
```

## Request / Response shapes
**POST /api/task/:uid/comments**: `{ "content": "Looks good, ship it" }` → `{ "uid": "cmt-abc", "task_id": 1, "user_id": 2, "content": "Looks good, ship it", "created_at": "...", "user": { "id": 2, "name": "Lucian", "email": "..." } }`.
**GET /api/task/:uid/comments**: `{ "comments": [ ... ] }`.

## Critério de pronto
- [ ] Migration cria `comments` table; model + associação Task.hasMany(Comment).
- [ ] CRUD endpoints funcionam; access: rw comenta, ro lê, autor edita/deleta.
- [ ] Notif `comment_added` criada para task owner (se autor ≠ owner).
- [ ] Suítes verde; lint limpo.

## Commit
`feat(comments): task comments module with notifications and access control` — "Implements plans/67a". Branch `feat/67-task-comments`, sem merge/push.

## Fora de escopo
- @mention parsing (não aprovado).
- Markdown rendering (não aprovado).
- Threaded replies (não aprovado).
- Attachments em comments (não aprovado).
