const request = require('supertest');
const app = require('../../app');
const { Task, View, User } = require('../../models');
const { createTestUser } = require('../helpers/testUtils');

describe('Tasks — energy field (plan 51)', () => {
    let user, agent;

    beforeEach(async () => {
        const email =
            'energy-' +
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

    describe('create / update round-trip', () => {
        it('persists numeric energy and returns it', async () => {
            const response = await agent.post('/api/task').send({
                name: 'Revisar código',
                energy: 2,
            });

            expect(response.status).toBe(201);
            expect(response.body.energy).toBe(2);

            const fetched = await Task.findByPk(response.body.id);
            expect(fetched.energy).toBe(2);
        });

        it('defaults energy to null when not provided', async () => {
            const response = await agent.post('/api/task').send({
                name: 'Tarefa normal',
            });

            expect(response.status).toBe(201);
            expect(response.body.energy).toBeNull();
        });

        it('accepts named energy on create and converts to numeric', async () => {
            const response = await agent.post('/api/task').send({
                name: 'Tarefa leve',
                energy: 'low',
            });

            expect(response.status).toBe(201);
            expect(response.body.energy).toBe(0);
        });

        it('PATCH energy updates the value', async () => {
            const createRes = await agent.post('/api/task').send({
                name: 'Muda energia',
                energy: 0,
            });
            expect(createRes.body.energy).toBe(0);

            const patchRes = await agent
                .patch(`/api/task/${createRes.body.uid}`)
                .send({ energy: 'high' });

            expect(patchRes.status).toBe(200);
            expect(patchRes.body.energy).toBe(2);
        });

        it('PATCH energy=null clears the value', async () => {
            const createRes = await agent.post('/api/task').send({
                name: 'Limpa energia',
                energy: 1,
            });
            expect(createRes.body.energy).toBe(1);

            const patchRes = await agent
                .patch(`/api/task/${createRes.body.uid}`)
                .send({ energy: null });

            expect(patchRes.status).toBe(200);
            expect(patchRes.body.energy).toBeNull();
        });
    });

    describe('GET /api/tasks?energy=', () => {
        let lowTask, mediumTask, highTask, nullTask;

        beforeEach(async () => {
            lowTask = await Task.create({
                name: 'Low energy task',
                user_id: user.id,
                status: Task.STATUS.NOT_STARTED,
                energy: 0,
            });
            mediumTask = await Task.create({
                name: 'Medium energy task',
                user_id: user.id,
                status: Task.STATUS.NOT_STARTED,
                energy: 1,
            });
            highTask = await Task.create({
                name: 'High energy task',
                user_id: user.id,
                status: Task.STATUS.NOT_STARTED,
                energy: 2,
            });
            nullTask = await Task.create({
                name: 'No energy task',
                user_id: user.id,
                status: Task.STATUS.NOT_STARTED,
                energy: null,
            });
        });

        it('filters by energy=low (only energy 0)', async () => {
            const response = await agent.get('/api/tasks?energy=low');

            expect(response.status).toBe(200);
            const ids = response.body.tasks.map((t) => t.id);
            expect(ids).toContain(lowTask.id);
            expect(ids).not.toContain(mediumTask.id);
            expect(ids).not.toContain(highTask.id);
            expect(ids).not.toContain(nullTask.id);
        });

        it('filters by energy=high (only energy 2)', async () => {
            const response = await agent.get('/api/tasks?energy=high');

            expect(response.status).toBe(200);
            const ids = response.body.tasks.map((t) => t.id);
            expect(ids).toContain(highTask.id);
            expect(ids).not.toContain(lowTask.id);
        });

        it('invalid energy string is a no-op (returns all, no crash)', async () => {
            const response = await agent.get('/api/tasks?energy=bogus');

            expect(response.status).toBe(200);
            const ids = response.body.tasks.map((t) => t.id);
            // No filter applied: legacy/null tasks reappear alongside.
            expect(ids).toContain(nullTask.id);
        });

        it('order_by=energy:desc orders tasks by energy', async () => {
            const response = await agent.get('/api/tasks?order_by=energy:desc');

            expect(response.status).toBe(200);
            const energies = response.body.tasks
                .map((t) => t.energy)
                .filter((e) => e !== null);
            // Descending: high before medium before low.
            for (let i = 1; i < energies.length; i++) {
                expect(energies[i]).toBeLessThanOrEqual(energies[i - 1]);
            }
        });
    });

    describe('Views with energy filter', () => {
        it('creates a view with energy=high and round-trips', async () => {
            const response = await agent.post('/api/views').send({
                name: 'High energy view',
                filters: ['Task'],
                energy: 'high',
            });

            expect(response.status).toBe(201);
            expect(response.body.energy).toBe('high');

            const getResponse = await agent.get(
                `/api/views/${response.body.uid}`
            );
            expect(getResponse.status).toBe(200);
            expect(getResponse.body.energy).toBe('high');
        });

        it('rejects an invalid energy value with 400', async () => {
            const response = await agent.post('/api/views').send({
                name: 'Bad energy view',
                filters: ['Task'],
                energy: 'bogus',
            });

            expect(response.status).toBe(400);
            expect(response.body.error).toBe('Invalid energy');
        });

        it('allows null/undefined energy (no filter)', async () => {
            const response = await agent.post('/api/views').send({
                name: 'No energy view',
                filters: ['Task'],
                energy: null,
            });

            expect(response.status).toBe(201);
            expect(response.body.energy).toBeNull();
        });
    });

    describe('legacy tasks (energy=null) do not break', () => {
        it('appear in default listing', async () => {
            const legacy = await Task.create({
                name: 'Legacy task',
                user_id: user.id,
                status: Task.STATUS.NOT_STARTED,
                energy: null,
            });

            const response = await agent.get('/api/tasks?type=all');
            expect(response.status).toBe(200);
            const ids = response.body.tasks.map((t) => t.id);
            expect(ids).toContain(legacy.id);
        });

        it('do not appear in ?energy=low', async () => {
            const legacy = await Task.create({
                name: 'Legacy task 2',
                user_id: user.id,
                status: Task.STATUS.NOT_STARTED,
                energy: null,
            });

            const response = await agent.get('/api/tasks?energy=low');
            expect(response.status).toBe(200);
            const ids = response.body.tasks.map((t) => t.id);
            expect(ids).not.toContain(legacy.id);
        });
    });
});
