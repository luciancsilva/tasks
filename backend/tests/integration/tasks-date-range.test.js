const request = require('supertest');
const app = require('../../app');
const { Task, User } = require('../../models');
const { createTestUser } = require('../helpers/testUtils');

const DAY = 24 * 60 * 60 * 1000;
const iso = (d) => new Date(d).toISOString().slice(0, 10);

describe('Custom date range filter (58)', () => {
    let user, agent;

    beforeEach(async () => {
        user = await createTestUser({ email: 'daterange@example.com' });
        agent = request.agent(app);
        await agent.post('/api/login').send({
            email: 'daterange@example.com',
            password: 'password123',
        });
    });

    const makeTask = async (name, dueOffsetDays) => {
        return Task.create({
            name,
            user_id: user.id,
            status: 0,
            due_date: new Date(Date.now() + dueOffsetDays * DAY),
        });
    };

    describe('GET /api/tasks due_from/due_to', () => {
        it('filters tasks within range', async () => {
            await makeTask('in-range', 5);
            await makeTask('out-before', -5);
            await makeTask('out-after', 20);

            const from = iso(Date.now() + DAY);
            const to = iso(Date.now() + 10 * DAY);
            const res = await agent.get(
                `/api/tasks?due_from=${from}&due_to=${to}`
            );
            expect(res.status).toBe(200);
            const names = res.body.tasks.map((t) => t.name);
            expect(names).toContain('in-range');
            expect(names).not.toContain('out-before');
            expect(names).not.toContain('out-after');
        });

        it('due_from only (>=)', async () => {
            await makeTask('future', 5);
            await makeTask('past', -5);
            const from = iso(Date.now() + DAY);
            const res = await agent.get(`/api/tasks?due_from=${from}`);
            expect(res.status).toBe(200);
            const names = res.body.tasks.map((t) => t.name);
            expect(names).toContain('future');
            expect(names).not.toContain('past');
        });

        it('due_to only (<=)', async () => {
            await makeTask('future', 5);
            await makeTask('past', -5);
            const to = iso(Date.now() + DAY);
            const res = await agent.get(`/api/tasks?due_to=${to}`);
            expect(res.status).toBe(200);
            const names = res.body.tasks.map((t) => t.name);
            expect(names).toContain('past');
            expect(names).not.toContain('future');
        });
    });

    describe('GET /api/search due_from/due_to', () => {
        it('applies range in search', async () => {
            await makeTask('in-range', 5);
            await makeTask('out-after', 20);
            const from = iso(Date.now() + DAY);
            const to = iso(Date.now() + 10 * DAY);
            const res = await agent.get(
                `/api/search?filters=Task&due_from=${from}&due_to=${to}`
            );
            expect(res.status).toBe(200);
            const names = res.body.results.map((r) => r.name);
            expect(names).toContain('in-range');
            expect(names).not.toContain('out-after');
        });
    });

    describe('View due_from/due_to', () => {
        it('persists and filters on view', async () => {
            await makeTask('in-range', 5);
            await makeTask('out-after', 20);
            const from = iso(Date.now() + DAY);
            const to = iso(Date.now() + 10 * DAY);

            const createRes = await agent.post('/api/views').send({
                name: 'Sprint',
                due_from: from,
                due_to: to,
            });
            expect(createRes.status).toBe(201);
            expect(createRes.body.due_from).toBe(from);
            expect(createRes.body.due_to).toBe(to);
        });

        it('retrocompat: view with due bucket still works', async () => {
            const createRes = await agent
                .post('/api/views')
                .send({ name: 'Today bucket', due: 'today' });
            expect(createRes.status).toBe(201);
            expect(createRes.body.due).toBe('today');
            expect(createRes.body.due_from).toBeNull();
        });

        it('rejects due_from > due_to with 400', async () => {
            const createRes = await agent.post('/api/views').send({
                name: 'Bad range',
                due_from: '2026-07-30',
                due_to: '2026-07-15',
            });
            expect(createRes.status).toBe(400);
        });
    });
});
