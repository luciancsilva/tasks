const request = require('supertest');
const app = require('../../app');
const { Task, User } = require('../../models');
const { createTestUser } = require('../helpers/testUtils');
const { v4: uuidv4 } = require('uuid');

describe('Bulk Tasks Routes', () => {
    let user, agent;

    beforeEach(async () => {
        user = await createTestUser({
            email: 'bulktest@example.com',
        });

        // Create authenticated agent
        agent = request.agent(app);
        await agent.post('/api/login').send({
            email: 'bulktest@example.com',
            password: 'password123',
        });
    });

    describe('POST /api/tasks/bulk', () => {
        it('should update multiple tasks', async () => {
            const task1 = await Task.create({
                name: 'Task 1',
                user_id: user.id,
                status: 'not_started',
                uid: uuidv4(),
            });
            const task2 = await Task.create({
                name: 'Task 2',
                user_id: user.id,
                status: 'not_started',
                uid: uuidv4(),
            });

            const response = await agent.post('/api/tasks/bulk').send({
                uids: [task1.uid, task2.uid],
                fields: { status: 'done', priority: 2 },
            });

            expect(response.status).toBe(200);
            expect(response.body.updated).toHaveLength(2);
            expect(response.body.failed).toHaveLength(0);

            const updatedTask1 = await Task.findByPk(task1.id);
            const updatedTask2 = await Task.findByPk(task2.id);
            expect(updatedTask1.status).toBe(2);
            expect(updatedTask1.priority).toBe(2);
            expect(updatedTask2.status).toBe(2);
            expect(updatedTask2.priority).toBe(2);
        });

        it('should require authentication', async () => {
            const response = await request(app)
                .post('/api/tasks/bulk')
                .send({
                    uids: ['123'],
                    fields: { status: 'done' },
                });

            expect(response.status).toBe(401);
            expect(response.body.error).toBe('Authentication required');
        });
    });

    describe('POST /api/tasks/bulk-delete', () => {
        it('should delete multiple tasks', async () => {
            const task1 = await Task.create({
                name: 'Task 1',
                user_id: user.id,
                status: 'not_started',
                uid: uuidv4(),
            });
            const task2 = await Task.create({
                name: 'Task 2',
                user_id: user.id,
                status: 'not_started',
                uid: uuidv4(),
            });

            const response = await agent.post('/api/tasks/bulk-delete').send({
                uids: [task1.uid, task2.uid],
            });

            expect(response.status).toBe(200);
            expect(response.body.deleted).toHaveLength(2);
            expect(response.body.failed).toHaveLength(0);

            const deletedTask1 = await Task.findByPk(task1.id);
            const deletedTask2 = await Task.findByPk(task2.id);
            expect(deletedTask1).toBeNull();
            expect(deletedTask2).toBeNull();
        });

        it('should require authentication', async () => {
            const response = await request(app)
                .post('/api/tasks/bulk-delete')
                .send({
                    uids: ['123'],
                });

            expect(response.status).toBe(401);
            expect(response.body.error).toBe('Authentication required');
        });
    });
});
