const request = require('supertest');
const app = require('../../app');
const { Task, TaskEvent, User } = require('../../models');
const { createTestUser } = require('../helpers/testUtils');

describe('Task focus session (59)', () => {
    let user, agent, task;

    beforeEach(async () => {
        user = await createTestUser({ email: 'focus@example.com' });
        agent = request.agent(app);
        await agent.post('/api/login').send({
            email: 'focus@example.com',
            password: 'password123',
        });
        task = await Task.create({
            name: 'Focusable task',
            user_id: user.id,
            status: 0,
        });
    });

    it('logs a focus session as a TaskEvent', async () => {
        const res = await agent
            .post(`/api/task/${task.uid}/focus-session`)
            .send({
                duration_sec: 1500,
                started_at: '2026-07-18T14:00:00Z',
                ended_at: '2026-07-18T14:25:00Z',
            });
        expect(res.status).toBe(201);
        expect(res.body.logged).toBe(true);

        const ev = await TaskEvent.findOne({
            where: { task_id: task.id, event_type: 'focus_session' },
        });
        expect(ev).not.toBeNull();
        expect(ev.field_name).toBe('focus_session');
        expect(ev.metadata.duration_sec).toBe(1500);
    });

    it('rejects invalid duration_sec with 400', async () => {
        const res = await agent
            .post(`/api/task/${task.uid}/focus-session`)
            .send({ duration_sec: 0 });
        expect(res.status).toBe(400);
    });

    it('rejects nonexistent task (403/404)', async () => {
        const res = await agent
            .post('/api/task/nonexistent-uid/focus-session')
            .send({ duration_sec: 1500 });
        expect([403, 404]).toContain(res.status);
    });

    it('requires authentication', async () => {
        const res = await request(app)
            .post(`/api/task/${task.uid}/focus-session`)
            .send({ duration_sec: 1500 });
        expect(res.status).toBe(401);
    });
});
