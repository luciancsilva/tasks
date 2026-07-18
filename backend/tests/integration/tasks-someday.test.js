const request = require('supertest');
const app = require('../../app');
const { Task, Tag, User } = require('../../models');
const { createTestUser } = require('../helpers/testUtils');

describe('Tasks — Someday/Maybe (plan 49)', () => {
    let user, agent;

    beforeEach(async () => {
        const email =
            'someday-' +
            Date.now() +
            '-' +
            Math.random().toString(36).slice(2) +
            '@example.com';
        user = await createTestUser({ email });

        agent = request.agent(app);
        await agent.post('/api/login').send({
            email,
            password: 'password123',
        });
    });

    describe('create with is_someday flag', () => {
        it('should persist is_someday=true and return it on response', async () => {
            const response = await agent.post('/api/task').send({
                name: 'Aprender violino',
                is_someday: true,
            });

            expect(response.status).toBe(201);
            expect(response.body.is_someday).toBe(true);

            const fetched = await Task.findByPk(response.body.id);
            expect(fetched.is_someday).toBe(true);
        });

        it('should default is_someday=false when not provided', async () => {
            const response = await agent.post('/api/task').send({
                name: 'Tarefa corrente',
            });

            expect(response.status).toBe(201);
            expect(response.body.is_someday).toBe(false);
        });
    });

    describe('update with is_someday toggle', () => {
        it('should flip is_someday on PATCH', async () => {
            const createRes = await agent.post('/api/task').send({
                name: 'Estudar japonês',
            });
            expect(createRes.body.is_someday).toBe(false);

            const patchRes = await agent
                .patch(`/api/task/${createRes.body.uid}`)
                .send({ is_someday: true });

            expect(patchRes.status).toBe(200);
            expect(patchRes.body.is_someday).toBe(true);

            const flipBack = await agent
                .patch(`/api/task/${createRes.body.uid}`)
                .send({ is_someday: false });

            expect(flipBack.status).toBe(200);
            expect(flipBack.body.is_someday).toBe(false);
        });
    });

    describe('GET /api/tasks?type=someday', () => {
        let somedayTask, activeTask, tagOnlyTask;

        beforeEach(async () => {
            somedayTask = await Task.create({
                name: 'Piano someday',
                user_id: user.id,
                status: Task.STATUS.NOT_STARTED,
                is_someday: true,
            });

            activeTask = await Task.create({
                name: 'Tarefa ativa',
                user_id: user.id,
                status: Task.STATUS.NOT_STARTED,
                is_someday: false,
            });

            // Retrocompat: legacy task sem flag mas com tag someday.
            tagOnlyTask = await Task.create({
                name: 'Tag-only someday',
                user_id: user.id,
                status: Task.STATUS.NOT_STARTED,
                is_someday: false,
            });
            // The user.afterCreate hook auto-seeds 'someday'/'today' system tags
            // (backend/models/index.js:355-368), so just find the existing one.
            const somedayTag =
                (await Tag.findOne({
                    where: { user_id: user.id, name: 'someday' },
                })) ||
                (await Tag.create({
                    user_id: user.id,
                    name: 'someday',
                    tag_type: 'system',
                    pinned: true,
                }));
            await tagOnlyTask.addTag(somedayTag);
        });

        it('should include is_someday=true tasks', async () => {
            const response = await agent.get('/api/tasks?type=someday');

            expect(response.status).toBe(200);
            const ids = response.body.tasks.map((t) => t.id);
            expect(ids).toContain(somedayTask.id);
        });

        it('should NOT include non-someday tasks', async () => {
            const response = await agent.get('/api/tasks?type=someday');

            expect(response.status).toBe(200);
            const ids = response.body.tasks.map((t) => t.id);
            expect(ids).not.toContain(activeTask.id);
        });

        it('should include legacy tasks tagged `someday` (retrocompat)', async () => {
            const response = await agent.get('/api/tasks?type=someday');

            expect(response.status).toBe(200);
            const ids = response.body.tasks.map((t) => t.id);
            expect(ids).toContain(tagOnlyTask.id);
        });
    });

    describe('exclusion from action lists', () => {
        it('might-someday tasks should not appear in ?type=today', async () => {
            const somedayTask = await Task.create({
                name: 'Someday hoje',
                user_id: user.id,
                status: Task.STATUS.IN_PROGRESS,
                is_someday: true,
            });

            const response = await agent.get('/api/tasks?type=today');

            expect(response.status).toBe(200);
            const ids = response.body.tasks
                .map((t) => t.id)
                .filter((id) => id === somedayTask.id);
            expect(ids).toEqual([]);
        });

        it('might-someday tasks should not appear in ?type=inbox', async () => {
            const somedayTask = await Task.create({
                name: 'Someday inbox',
                user_id: user.id,
                status: Task.STATUS.NOT_STARTED,
                is_someday: true,
            });

            const response = await agent.get('/api/tasks?type=inbox');

            const ids = response.body.tasks.map((t) => t.id);
            expect(ids).not.toContain(somedayTask.id);
        });

        it('might-someday tasks should not appear in ?type=next', async () => {
            const somedayTask = await Task.create({
                name: 'Someday next',
                user_id: user.id,
                status: Task.STATUS.IN_PROGRESS,
                is_someday: true,
            });

            const response = await agent.get('/api/tasks?type=next');

            const ids = response.body.tasks.map((t) => t.id);
            expect(ids).not.toContain(somedayTask.id);
        });

        it('might-someday tasks should not appear in ?status=active', async () => {
            const somedayTask = await Task.create({
                name: 'Someday active',
                user_id: user.id,
                status: Task.STATUS.IN_PROGRESS,
                is_someday: true,
            });

            const response = await agent.get('/api/tasks?status=active');

            const ids = response.body.tasks.map((t) => t.id);
            expect(ids).not.toContain(somedayTask.id);
        });
    });
});
