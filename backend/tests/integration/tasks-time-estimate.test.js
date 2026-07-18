const request = require('supertest');
const app = require('../../app');
const { Task } = require('../../models');
const { createTestUser } = require('../helpers/testUtils');

describe('Tasks — time_estimate field (plan 52)', () => {
    let user, agent;

    beforeEach(async () => {
        const email =
            'timeest-' +
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
        it('persists time_estimate and returns it', async () => {
            const response = await agent.post('/api/task').send({
                name: 'Call standup',
                time_estimate: 15,
            });

            expect(response.status).toBe(201);
            expect(response.body.time_estimate).toBe(15);

            const fetched = await Task.findByPk(response.body.id);
            expect(fetched.time_estimate).toBe(15);
        });

        it('defaults time_estimate to null when not provided', async () => {
            const response = await agent.post('/api/task').send({
                name: 'Tarefa normal',
            });

            expect(response.status).toBe(201);
            expect(response.body.time_estimate).toBeNull();
        });

        it('PATCH time_estimate updates the value', async () => {
            const createRes = await agent.post('/api/task').send({
                name: 'Muda estimativa',
                time_estimate: 30,
            });
            expect(createRes.body.time_estimate).toBe(30);

            const patchRes = await agent
                .patch(`/api/task/${createRes.body.uid}`)
                .send({ time_estimate: 60 });

            expect(patchRes.status).toBe(200);
            expect(patchRes.body.time_estimate).toBe(60);
        });

        it('PATCH time_estimate=null clears the value', async () => {
            const createRes = await agent.post('/api/task').send({
                name: 'Limpa estimativa',
                time_estimate: 45,
            });
            expect(createRes.body.time_estimate).toBe(45);

            const patchRes = await agent
                .patch(`/api/task/${createRes.body.uid}`)
                .send({ time_estimate: null });

            expect(patchRes.status).toBe(200);
            expect(patchRes.body.time_estimate).toBeNull();
        });
    });

    describe('GET /api/tasks?time_max= / time_min=', () => {
        let quick, medium, long, nullTask;

        beforeEach(async () => {
            quick = await Task.create({
                name: 'Quick task',
                user_id: user.id,
                status: Task.STATUS.NOT_STARTED,
                time_estimate: 10,
            });
            medium = await Task.create({
                name: 'Medium task',
                user_id: user.id,
                status: Task.STATUS.NOT_STARTED,
                time_estimate: 30,
            });
            long = await Task.create({
                name: 'Long task',
                user_id: user.id,
                status: Task.STATUS.NOT_STARTED,
                time_estimate: 120,
            });
            nullTask = await Task.create({
                name: 'Unestimated task',
                user_id: user.id,
                status: Task.STATUS.NOT_STARTED,
                time_estimate: null,
            });
        });

        it('time_max=15 returns only tasks that fit (and never null)', async () => {
            const response = await agent.get('/api/tasks?time_max=15');

            expect(response.status).toBe(200);
            const ids = response.body.tasks.map((t) => t.id);
            expect(ids).toContain(quick.id);
            expect(ids).not.toContain(medium.id);
            expect(ids).not.toContain(long.id);
            expect(ids).not.toContain(nullTask.id);
        });

        it('time_min=60&time_max=120 returns the range', async () => {
            const response = await agent.get(
                '/api/tasks?time_min=60&time_max=120'
            );

            expect(response.status).toBe(200);
            const ids = response.body.tasks.map((t) => t.id);
            expect(ids).toContain(long.id);
            expect(ids).not.toContain(quick.id);
            expect(ids).not.toContain(medium.id);
            expect(ids).not.toContain(nullTask.id);
        });

        it('order_by=time_estimate:asc orders tasks', async () => {
            const response = await agent.get(
                '/api/tasks?order_by=time_estimate:asc'
            );

            expect(response.status).toBe(200);
            const times = response.body.tasks
                .map((t) => t.time_estimate)
                .filter((v) => v !== null);
            for (let i = 1; i < times.length; i++) {
                expect(times[i]).toBeGreaterThanOrEqual(times[i - 1]);
            }
        });

        it('time_max=0 returns 400', async () => {
            const response = await agent.get('/api/tasks?time_max=0');

            expect(response.status).toBe(400);
            expect(response.body.error).toBe('Invalid time_max');
        });

        it('time_max negative returns 400', async () => {
            const response = await agent.get('/api/tasks?time_max=-5');

            expect(response.status).toBe(400);
            expect(response.body.error).toBe('Invalid time_max');
        });
    });

    describe('Views with time_max filter', () => {
        it('creates a view with time_max=30 and round-trips', async () => {
            const response = await agent.post('/api/views').send({
                name: 'Quick wins',
                filters: ['Task'],
                time_max: 30,
            });

            expect(response.status).toBe(201);
            expect(response.body.time_max).toBe(30);

            const getResponse = await agent.get(
                `/api/views/${response.body.uid}`
            );
            expect(getResponse.status).toBe(200);
            expect(getResponse.body.time_max).toBe(30);
        });

        it('rejects an invalid time_max value with 400', async () => {
            const response = await agent.post('/api/views').send({
                name: 'Bad time view',
                filters: ['Task'],
                time_max: 0,
            });

            expect(response.status).toBe(400);
            expect(response.body.error).toBe('Invalid time_max');
        });

        it('allows null/undefined time_max (no filter)', async () => {
            const response = await agent.post('/api/views').send({
                name: 'No time view',
                filters: ['Task'],
                time_max: null,
            });

            expect(response.status).toBe(201);
            expect(response.body.time_max).toBeNull();
        });
    });

    describe('legacy tasks (time_estimate=null) do not break', () => {
        it('appear in default listing but not in ?time_max=15', async () => {
            const legacy = await Task.create({
                name: 'Legacy task',
                user_id: user.id,
                status: Task.STATUS.NOT_STARTED,
                time_estimate: null,
            });

            const allRes = await agent.get('/api/tasks?type=all');
            expect(allRes.status).toBe(200);
            expect(allRes.body.tasks.map((t) => t.id)).toContain(legacy.id);

            const filteredRes = await agent.get('/api/tasks?time_max=15');
            expect(filteredRes.status).toBe(200);
            expect(filteredRes.body.tasks.map((t) => t.id)).not.toContain(
                legacy.id
            );
        });
    });
});
