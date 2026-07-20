const request = require('supertest');
const app = require('../../app');
const { sequelize, User, InboxItem, Task } = require('../../models');

const { createTestUser } = require('../helpers/testUtils');

describe('Inbox Bulk Operations API', () => {
    let user;
    let agent;
    let inboxItems = [];

    beforeEach(async () => {
        user = await createTestUser({ email: 'bulk.inbox@example.com' });

        agent = request.agent(app);
        await agent.post('/api/login').send({
            email: 'bulk.inbox@example.com',
            password: 'password123',
        });

        await InboxItem.destroy({ where: {} });
        await Task.destroy({ where: {} });

        inboxItems = [];
        inboxItems.push(
            await InboxItem.create({
                user_id: user.id,
                content: 'Bulk Task 1',
                source: 'test',
            })
        );
        inboxItems.push(
            await InboxItem.create({
                user_id: user.id,
                content: 'Bulk Task 2',
                source: 'test',
            })
        );
        inboxItems.push(
            await InboxItem.create({
                user_id: user.id,
                content: 'Bulk Task 3',
                source: 'test',
            })
        );
    });

    it('POST /inbox/bulk should process items into tasks', async () => {
        const uids = [inboxItems[0].uid, inboxItems[1].uid];
        console.log('uids:', uids);
        const res = await agent
            .post('/api/inbox/bulk')
            .send({ uids, sharedTags: ['bulk-test'] });

        console.log('res.body:', res.body);
        expect(res.status).toBe(200);
        expect(res.body.created.length).toBe(2);
        expect(res.body.failed.length).toBe(0);

        const tasks = await Task.findAll({
            where: { user_id: user.id },
            include: 'Tags',
        });
        expect(tasks.length).toBe(2);
        expect(tasks[0].Tags.map((t) => t.name)).toContain('bulk-test');

        const items = await InboxItem.findAll({
            where: { user_id: user.id, status: 'processed' },
        });
        expect(items.length).toBe(2);
    });

    it('POST /inbox/bulk-delete should soft delete items', async () => {
        const uids = [inboxItems[0].uid];
        const res = await agent.post('/api/inbox/bulk-delete').send({ uids });

        expect(res.status).toBe(200);
        expect(res.body.deleted.length).toBe(1);

        const items = await InboxItem.findAll({
            where: { user_id: user.id, status: 'deleted' },
        });
        expect(items.length).toBe(1);
    });

    it('POST /inbox/bulk-mark-processed should mark items as processed without creating tasks', async () => {
        const uids = [inboxItems[2].uid];
        const res = await agent
            .post('/api/inbox/bulk-mark-processed')
            .send({ uids });

        expect(res.status).toBe(200);
        expect(res.body.processed.length).toBe(1);

        const tasks = await Task.findAll({ where: { user_id: user.id } });
        expect(tasks.length).toBe(0);

        const items = await InboxItem.findAll({
            where: { user_id: user.id, status: 'processed' },
        });
        expect(items.length).toBe(1);
    });
});
