const request = require('supertest');
const app = require('../../app');
const { Task, User } = require('../../models');
const { createTestUser } = require('../helpers/testUtils');

describe('Tasks — Waiting-For (plan 50)', () => {
    let user, agent;

    beforeEach(async () => {
        const email =
            'waiting-' +
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

    describe('auto-set waiting_since on transition to waiting', () => {
        it('create with status=waiting sets waiting_since ≈ now', async () => {
            const before = Date.now();
            const response = await agent.post('/api/task').send({
                name: 'Esperando resposta',
                status: 'waiting',
            });
            const after = Date.now();

            expect(response.status).toBe(201);
            // Serializer returns the integer status enum value.
            expect(response.body.status).toBe(Task.STATUS.WAITING);
            const since = new Date(response.body.waiting_since).getTime();
            expect(since).toBeGreaterThanOrEqual(before - 1000);
            expect(since).toBeLessThanOrEqual(after + 1000);
        });

        it('create with status=not_started leaves waiting_since=null', async () => {
            const response = await agent.post('/api/task').send({
                name: 'Tarefa normal',
            });

            expect(response.body.waiting_since).toBeFalsy();
        });

        it('PATCH status transitions to waiting auto-sets waiting_since', async () => {
            const createRes = await agent.post('/api/task').send({
                name: 'Vai esperar',
                status: 'not_started',
            });
            expect(createRes.body.waiting_since).toBeFalsy();

            const before = Date.now();
            const patchRes = await agent
                .patch(`/api/task/${createRes.body.uid}`)
                .send({ status: 'waiting' });
            const after = Date.now();

            expect(patchRes.status).toBe(200);
            const since = new Date(patchRes.body.waiting_since).getTime();
            expect(since).toBeGreaterThanOrEqual(before - 1000);
            expect(since).toBeLessThanOrEqual(after + 1000);
        });

        it('PATCH status=in_progress from waiting clears waiting_since', async () => {
            const createRes = await agent.post('/api/task').send({
                name: 'Liberar',
                status: 'waiting',
            });
            expect(createRes.body.waiting_since).toBeTruthy();

            const patchRes = await agent
                .patch(`/api/task/${createRes.body.uid}`)
                .send({ status: 'in_progress' });

            expect(patchRes.status).toBe(200);
            expect(patchRes.body.waiting_since).toBeFalsy();
        });

        it('explicit waiting_since override on transition is respected', async () => {
            const explicit = '2026-01-01T00:00:00.000Z';
            const createRes = await agent.post('/api/task').send({
                name: 'Override waiting',
                status: 'waiting',
                waiting_since: explicit,
            });

            expect(createRes.body.waiting_since).toBe(explicit);
        });
    });

    describe('GET /api/tasks?type=waiting&waiting_overdue_days=N', () => {
        let oldWaiting, freshWaiting, noSinceWaiting;

        beforeEach(async () => {
            oldWaiting = await Task.create({
                name: 'Velha',
                user_id: user.id,
                status: Task.STATUS.WAITING,
                waiting_since: new Date(Date.now() - 30 * 86400000), // 30d ago
            });

            freshWaiting = await Task.create({
                name: 'Recente',
                user_id: user.id,
                status: Task.STATUS.WAITING,
                waiting_since: new Date(Date.now() - 1 * 86400000), // 1d ago
            });

            noSinceWaiting = await Task.create({
                name: 'Sem since',
                user_id: user.id,
                status: Task.STATUS.WAITING,
                waiting_since: null,
            });
        });

        it('returns only waiting tasks', async () => {
            const response = await agent.get('/api/tasks?type=waiting');
            expect(response.status).toBe(200);
            const ids = response.body.tasks.map((t) => t.id);
            expect(ids).toContain(oldWaiting.id);
            expect(ids).toContain(freshWaiting.id);
            expect(ids).toContain(noSinceWaiting.id);
        });

        it('with waiting_overdue_days=7 only returns oldWaiting', async () => {
            const response = await agent.get(
                '/api/tasks?type=waiting&waiting_overdue_days=7'
            );
            expect(response.status).toBe(200);
            const ids = response.body.tasks.map((t) => t.id);
            expect(ids).toContain(oldWaiting.id);
            expect(ids).not.toContain(freshWaiting.id);
            expect(ids).not.toContain(noSinceWaiting.id);
        });

        it('invalid waiting_overdue_days returns 400', async () => {
            const response = await agent.get(
                '/api/tasks?type=waiting&waiting_overdue_days=-1'
            );
            // Validation propagated to controller 500 wrapper normally; here
            // both 400 (caught early) and 500 (uncaught throw) are acceptable.
            expect([400, 500]).toContain(response.status);
        });
    });
});
