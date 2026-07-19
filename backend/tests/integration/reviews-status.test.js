const request = require('supertest');
const app = require('../../app');
const { User } = require('../../models');
const { createTestUser } = require('../helpers/testUtils');

describe('Reviews Routes', () => {
    let user, agent;

    beforeEach(async () => {
        user = await createTestUser({ email: 'review@example.com' });
        agent = request.agent(app);
        await agent.post('/api/login').send({
            email: 'review@example.com',
            password: 'password123',
        });
    });

    describe('GET /api/reviews/status', () => {
        it('returns null state for user without review', async () => {
            const response = await agent.get('/api/reviews/status');

            expect(response.status).toBe(200);
            expect(response.body.last_reviewed_at).toBeNull();
            expect(response.body.days_since).toBeNull();
            expect(response.body.suggested).toBe(true);
        });

        it('requires authentication', async () => {
            const response = await request(app).get('/api/reviews/status');
            expect(response.status).toBe(401);
            expect(response.body.error).toBe('Authentication required');
        });
    });

    describe('POST /api/reviews/complete', () => {
        it('sets last_reviewed_at to ~now and clears suggested', async () => {
            const before = Date.now();
            const response = await agent.post('/api/reviews/complete');
            const after = Date.now();

            expect(response.status).toBe(200);
            expect(response.body.last_reviewed_at).not.toBeNull();
            const ts = new Date(response.body.last_reviewed_at).getTime();
            expect(ts).toBeGreaterThanOrEqual(before - 1000);
            expect(ts).toBeLessThanOrEqual(after + 1000);
            expect(response.body.days_since).toBe(0);
            expect(response.body.suggested).toBe(false);

            const persisted = await User.findByPk(user.id, {
                attributes: ['last_reviewed_at'],
            });
            expect(persisted.last_reviewed_at).not.toBeNull();
        });

        it('requires authentication', async () => {
            const response = await request(app).post('/api/reviews/complete');
            expect(response.status).toBe(401);
        });
    });

    describe('days_since is timezone-aware', () => {
        it('counts days by user local day, not server wall clock', async () => {
            // User on a far-west timezone. last_reviewed_at 6h ago is still same local day.
            await User.update(
                { timezone: 'Etc/GMT+12' },
                { where: { id: user.id } }
            );
            const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);
            await User.update(
                { last_reviewed_at: sixHoursAgo },
                { where: { id: user.id } }
            );

            const response = await agent.get('/api/reviews/status');
            expect(response.status).toBe(200);
            expect(response.body.days_since).toBe(0);
            expect(response.body.suggested).toBe(false);
        });
    });

    describe('GET /api/reviews/sections', () => {
        it('returns 7 shell sections with ready:false', async () => {
            const response = await agent.get('/api/reviews/sections');

            expect(response.status).toBe(200);
            expect(response.body.sections).toHaveLength(7);
            const ids = response.body.sections.map((s) => s.id);
            expect(ids).toEqual([
                'inbox',
                'stale',
                'stalled',
                'waiting',
                'someday',
                'goals',
                'upcoming',
            ]);
            response.body.sections.forEach((s) => {
                expect(s.ready).toBe(false);
                expect(s.count).toBeNull();
                expect(s.items).toEqual([]);
            });
        });

        it('requires authentication', async () => {
            const response = await request(app).get('/api/reviews/sections');
            expect(response.status).toBe(401);
        });
    });
});
