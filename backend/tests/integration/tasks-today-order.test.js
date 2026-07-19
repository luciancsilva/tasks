const request = require('supertest');
const app = require('../../app');
const { Task, User } = require('../../models');
const { createTestUser } = require('../helpers/testUtils');

describe('Today Plan order (61)', () => {
    let user, agent;

    beforeEach(async () => {
        user = await createTestUser({ email: 'todayorder@example.com' });
        agent = request.agent(app);
        await agent.post('/api/login').send({
            email: 'todayorder@example.com',
            password: 'password123',
        });
    });

    it('persists today_order via PATCH', async () => {
        const task = await Task.create({
            name: 'reorderable',
            user_id: user.id,
            status: 0,
        });
        const res = await agent.patch(`/api/task/${task.uid}`).send({
            today_order: 5,
        });
        expect(res.status).toBe(200);
        expect(res.body.today_order).toBe(5);

        const persisted = await Task.findByPk(task.id);
        expect(persisted.today_order).toBe(5);
    });

    it('clears today_order with null', async () => {
        const task = await Task.create({
            name: 'clearable',
            user_id: user.id,
            status: 0,
            today_order: 3,
        });
        const res = await agent.patch(`/api/task/${task.uid}`).send({
            today_order: null,
        });
        expect(res.status).toBe(200);
        expect(res.body.today_order).toBeNull();
    });

    it('orders by today_order with nulls last', async () => {
        const a = await Task.create({
            name: 'A',
            user_id: user.id,
            status: 0,
            today_order: 2,
        });
        const nullTask = await Task.create({
            name: 'null',
            user_id: user.id,
            status: 0,
            today_order: null,
        });
        const b = await Task.create({
            name: 'B',
            user_id: user.id,
            status: 0,
            today_order: 1,
        });

        const res = await agent.get(
            '/api/tasks?status=active&order_by=today_order:asc'
        );
        expect(res.status).toBe(200);
        const tasks = res.body.tasks || [];
        const names = tasks.map((t) => t.name);
        const bIdx = names.indexOf('B');
        const aIdx = names.indexOf('A');
        const nullIdx = names.indexOf('null');
        expect(bIdx).toBeLessThan(aIdx);
        expect(nullIdx).toBeGreaterThan(aIdx);
    });
});
