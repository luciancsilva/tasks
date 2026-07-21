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

    // The association is aliased `as: 'user'`; without it Sequelize keys it by
    // model name (`User`) and the client — which reads `comment.user` — shows
    // no author and cannot tell its own comments apart.
    it('should serialize the author under `user`, keyed by uid', async () => {
        const created = await ownerAgent
            .post(`/api/task/${task.uid}/comments`)
            .send({ content: 'Looks good' });

        expect(Object.keys(created.body.user).sort()).toEqual([
            'email',
            'name',
            'uid',
        ]);
        expect(created.body.user.uid).toBe(owner.uid);
        expect(created.body.user.email).toBe('owner@test.com');
        expect(created.body.User).toBeUndefined();
        expect(created.body.user.id).toBeUndefined();

        const listed = await ownerAgent.get(`/api/task/${task.uid}/comments`);
        expect(listed.body.comments[0].user.uid).toBe(owner.uid);
    });

    it('should refuse to let a non-author edit a comment', async () => {
        const created = await ownerAgent
            .post(`/api/task/${task.uid}/comments`)
            .send({ content: 'Looks good' });

        const res = await authorAgent
            .patch(`/api/comment/${created.body.uid}`)
            .send({ content: 'Hijacked' });

        expect(res.status).toBe(403);
    });
});
