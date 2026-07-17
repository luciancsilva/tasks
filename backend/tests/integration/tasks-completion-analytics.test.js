const request = require('supertest');
const app = require('../../app');
const { Task } = require('../../models');
const { createTestUser } = require('../helpers/testUtils');

describe('GET /api/tasks/completion-analytics', () => {
    let user, agent;

    beforeEach(async () => {
        user = await createTestUser({
            email: `test_${Date.now()}@example.com`,
        });

        agent = request.agent(app);
        await agent.post('/api/login').send({
            email: user.email,
            password: 'password123',
        });

        // Create a few completed tasks
        for (let i = 1; i <= 3; i++) {
            await Task.create({
                name: `Completed Task ${i}`,
                user_id: user.id,
                status: 2,
                completed_at: new Date(),
            });
        }
    });

    it('should cap an excessively large limit at MAX_LIMIT (100)', async () => {
        const spy = jest.spyOn(Task, 'findAll');

        const response = await agent.get(
            '/api/tasks/completion-analytics?limit=999999'
        );

        expect(response.status).toBe(200);
        expect(spy.mock.calls[0][0].limit).toBe(100);

        spy.mockRestore();
    });

    it('should still respect a valid small limit', async () => {
        const spy = jest.spyOn(Task, 'findAll');

        const response = await agent.get(
            '/api/tasks/completion-analytics?limit=2'
        );

        expect(response.status).toBe(200);
        expect(spy.mock.calls[0][0].limit).toBe(2);

        spy.mockRestore();
    });

    it('should default to 50 when no limit is provided', async () => {
        const spy = jest.spyOn(Task, 'findAll');

        const response = await agent.get('/api/tasks/completion-analytics');

        expect(response.status).toBe(200);
        expect(spy.mock.calls[0][0].limit).toBe(50);

        spy.mockRestore();
    });
});
