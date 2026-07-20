const request = require('supertest');
const app = require('../../app');
const { sequelize, User, Task, Comment } = require('../../models');

describe('Task Comments API', () => {
    let token, otherToken, authorId, ownerId, task;

    beforeAll(async () => {
        await sequelize.sync({ force: true });
        const owner = await User.create({ name: 'Owner', email: 'owner@test.com', password_hash: '123' });
        const author = await User.create({ name: 'Author', email: 'author@test.com', password_hash: '123' });
        ownerId = owner.id;
        authorId = author.id;
        
        // Simulating JWT tokens
        const jwt = require('jsonwebtoken');
        const config = require('../../config/config').getConfig();
        token = jwt.sign({ userId: authorId }, config.secret);
        otherToken = jwt.sign({ userId: ownerId }, config.secret);
        
        task = await Task.create({ user_id: ownerId, name: 'Test Task' });
    });

    afterAll(async () => {
        await sequelize.close();
    });

    it('should create a comment', async () => {
        const res = await request(app)
            .post(`/api/task/${task.uid}/comments`)
            .set('Authorization', `Bearer ${token}`)
            .send({ content: 'Looks good' });
        
        expect(res.status).toBe(201);
        expect(res.body.content).toBe('Looks good');
        expect(res.body.user_id).toBe(authorId);
    });

    it('should list comments', async () => {
        const res = await request(app)
            .get(`/api/task/${task.uid}/comments`)
            .set('Authorization', `Bearer ${otherToken}`);
            
        expect(res.status).toBe(200);
        expect(res.body.comments.length).toBe(1);
        expect(res.body.comments[0].content).toBe('Looks good');
    });
});
