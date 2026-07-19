const request = require('supertest');
const app = require('../../app');
const { createTestUser } = require('../helpers/testUtils');

// Plan 66: the inbox "2-min action" triage button creates a task already in
// status=done. The create path must stamp completed_at (the update path did via
// handleCompletionStatus, but create never did). "Someday" triage creates a
// task with is_someday=true.
describe('Task create — done stamps completed_at, someday flag (66)', () => {
    let agent;

    beforeEach(async () => {
        await createTestUser({ email: 'triage@example.com' });
        agent = request.agent(app);
        await agent.post('/api/login').send({
            email: 'triage@example.com',
            password: 'password123',
        });
    });

    it('stamps completed_at when a task is created directly as done', async () => {
        const before = Date.now();
        const res = await agent
            .post('/api/task')
            .send({ name: '2-min action', status: 'done' });

        expect(res.status).toBe(201);
        expect(res.body.status).toBe(2); // Task.STATUS.DONE
        expect(res.body.completed_at).not.toBeNull();
        const ts = new Date(res.body.completed_at).getTime();
        expect(ts).toBeGreaterThanOrEqual(before - 1000);
        expect(ts).toBeLessThanOrEqual(Date.now() + 1000);
    });

    it('leaves completed_at null for a task created not done', async () => {
        const res = await agent
            .post('/api/task')
            .send({ name: 'Regular action', status: 'not_started' });

        expect(res.status).toBe(201);
        expect(res.body.status).toBe(0); // Task.STATUS.NOT_STARTED
        expect(res.body.completed_at).toBeNull();
    });

    it('sets is_someday when creating a someday task', async () => {
        const res = await agent
            .post('/api/task')
            .send({ name: 'Someday idea', is_someday: true });

        expect(res.status).toBe(201);
        expect(res.body.is_someday).toBe(true);
        expect(res.body.completed_at).toBeNull();
    });
});
