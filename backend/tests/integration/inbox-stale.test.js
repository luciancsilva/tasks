const request = require('supertest');
const app = require('../../app');
const { InboxItem } = require('../../models');
const { createTestUser } = require('../helpers/testUtils');

describe('Inbox stale count (65)', () => {
    let user, agent;

    beforeEach(async () => {
        user = await createTestUser({
            email: 'stale@example.com',
        });
        agent = request.agent(app);
        await agent.post('/api/login').send({
            email: 'stale@example.com',
            password: 'password123',
        });
    });

    async function backdateCreated(itemId, hoursAgo) {
        // Sequelize's create/update timestamp hooks ignore an explicit
        // created_at value, so we backdate via raw SQL. Pass a Date object
        // (NOT an ISO string) so the bind format matches what Sequelize uses
        // for the Op.lt comparison — a string yields a text-vs-text mismatch.
        const ts = new Date(Date.now() - hoursAgo * 3600000);
        await InboxItem.sequelize.query(
            'UPDATE inbox_items SET created_at = ? WHERE id = ?',
            { replacements: [ts, itemId] }
        );
    }

    it('returns 0 when no items are stale', async () => {
        const res = await agent.get('/api/inbox/stale-count');
        expect(res.status).toBe(200);
        expect(res.body.stale_count).toBe(0);
    });

    it('counts only added items older than 48h', async () => {
        const fresh = await InboxItem.create({
            content: 'fresh 1h',
            user_id: user.id,
            status: 'added',
            source: 'web',
        });
        const mid = await InboxItem.create({
            content: 'mid 30h',
            user_id: user.id,
            status: 'added',
            source: 'web',
        });
        const stale = await InboxItem.create({
            content: 'stale 50h',
            user_id: user.id,
            status: 'added',
            source: 'web',
        });
        await backdateCreated(fresh.id, 1);
        await backdateCreated(mid.id, 30);
        await backdateCreated(stale.id, 50);

        const res = await agent.get('/api/inbox/stale-count');
        expect(res.status).toBe(200);
        expect(res.body.stale_count).toBe(1);
    });

    it('excludes processed/deleted items even if older than 48h', async () => {
        const processed = await InboxItem.create({
            content: 'processed but old',
            user_id: user.id,
            status: 'added',
            source: 'web',
        });
        const deleted = await InboxItem.create({
            content: 'deleted but old',
            user_id: user.id,
            status: 'added',
            source: 'web',
        });
        await backdateCreated(processed.id, 72);
        await backdateCreated(deleted.id, 96);
        await processed.update({ status: 'processed' });
        await deleted.update({ status: 'deleted' });

        const res = await agent.get('/api/inbox/stale-count');
        expect(res.status).toBe(200);
        expect(res.body.stale_count).toBe(0);
    });

    it('requires authentication', async () => {
        const res = await request(app).get('/api/inbox/stale-count');
        expect(res.status).toBe(401);
    });
});
