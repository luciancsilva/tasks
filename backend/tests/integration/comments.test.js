const request = require('supertest');
const app = require('../../app');
const { sequelize, User, Task } = require('../../models');
const { createTestUser } = require('../helpers/testUtils');

describe('Task Comments API', () => {
    let author, owner, task, authorAgent, ownerAgent;

    beforeEach(async () => {
        // Create users using testUtils
        owner = await createTestUser({ email: 'owner@test.com' });
        author = await createTestUser({ email: 'author@test.com' });

        ownerAgent = request.agent(app);
        await ownerAgent.post('/api/login').send({
            email: 'owner@test.com',
            password: 'password123',
        });

        authorAgent = request.agent(app);
        await authorAgent.post('/api/login').send({
            email: 'author@test.com',
            password: 'password123',
        });

        task = await Task.create({ user_id: owner.id, name: 'Test Task' });
    });

    it('should create a comment', async () => {
        const res = await ownerAgent
            .post(`/api/task/${task.uid}/comments`)
            .send({ content: 'Looks good' });

        expect(res.status).toBe(201);
        expect(res.body.content).toBe('Looks good');
        expect(res.body.user_id).toBe(owner.id);
    });

    it('should list comments', async () => {
        // Create a comment first to list it
        await ownerAgent
            .post(`/api/task/${task.uid}/comments`)
            .send({ content: 'Looks good' });

        const res = await ownerAgent.get(`/api/task/${task.uid}/comments`);

        expect(res.status).toBe(200);
        expect(res.body.comments.length).toBe(1);
        expect(res.body.comments[0].content).toBe('Looks good');
    });
});
