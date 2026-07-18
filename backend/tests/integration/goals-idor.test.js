'use strict';

const request = require('supertest');
const app = require('../../app');
const { createTestUser } = require('../helpers/testUtils');
const { Area } = require('../../models');

describe('Goals area_id IDOR prevention (plan 47)', () => {
    let agentA, agentB, areaA, areaB;

    beforeEach(async () => {
        const userA = await createTestUser({ email: `goals_idor_a_${Date.now()}@test.com` });
        const userB = await createTestUser({ email: `goals_idor_b_${Date.now()}@test.com` });

        agentA = request.agent(app);
        agentB = request.agent(app);

        await agentA.post('/api/login').send({ email: userA.email, password: 'password123' });
        await agentB.post('/api/login').send({ email: userB.email, password: 'password123' });

        // Create an area for each user
        areaA = await Area.create({ name: 'Area A', user_id: userA.id });
        areaB = await Area.create({ name: 'Area B', user_id: userB.id });
    });

    it('POST /goals with area_id of another user returns 403', async () => {
        const res = await agentA.post('/api/goals').send({
            title: 'Stolen Goal',
            area_id: areaB.id,
        });
        expect(res.status).toBe(403);
    });

    it('POST /goals with own area_id succeeds', async () => {
        const res = await agentA.post('/api/goals').send({
            title: 'Legit Goal',
            area_id: areaA.id,
        });
        expect([200, 201]).toContain(res.status);
    });

    it('PATCH /goals with area_id of another user returns 403', async () => {
        // First create a goal for A with A's area
        const createRes = await agentA.post('/api/goals').send({
            title: 'Goal to patch',
            area_id: areaA.id,
        });
        expect([200, 201]).toContain(createRes.status);
        const goal = createRes.body.goal || createRes.body;

        // Try to reassign to B's area
        const patchRes = await agentA.patch(`/api/goals/${goal.uid}`).send({
            area_id: areaB.id,
        });
        expect(patchRes.status).toBe(403);
    });
});
