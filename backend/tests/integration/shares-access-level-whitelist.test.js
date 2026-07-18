'use strict';

const request = require('supertest');
const app = require('../../app');
const { createTestUser } = require('../helpers/testUtils');

describe('Shares access_level whitelist', () => {
    let ownerAgent, project;

    beforeEach(async () => {
        const owner = await createTestUser({
            email: `owner_whitelist_${Date.now()}@test.com`,
        });

        ownerAgent = request.agent(app);
        await ownerAgent
            .post('/api/login')
            .send({ email: owner.email, password: 'password123' });

        const projectRes = await ownerAgent
            .post('/api/project')
            .send({ name: 'Whitelist Test Project' });
        project = projectRes.body;
    });

    it('rejects invalid access_level "owner" with 400', async () => {
        const res = await ownerAgent.post('/api/shares').send({
            resource_type: 'project',
            resource_uid: project.uid,
            target_user_email: 'nobody@example.com',
            access_level: 'owner',
        });

        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/invalid access_level/i);
    });

    it('rejects arbitrary string access_level with 400', async () => {
        const res = await ownerAgent.post('/api/shares').send({
            resource_type: 'project',
            resource_uid: project.uid,
            target_user_email: 'nobody@example.com',
            access_level: 'xx',
        });

        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/invalid access_level/i);
    });

    it('passes whitelist for "ro" (fails at user lookup, not access_level)', async () => {
        const res = await ownerAgent.post('/api/shares').send({
            resource_type: 'project',
            resource_uid: project.uid,
            target_user_email: 'nobody@example.com',
            access_level: 'ro',
        });

        // 'ro' is valid — fails at target user lookup (404), not at access_level validation (400)
        expect(res.status).not.toBe(400);
    });

    it('passes whitelist for "rw"', async () => {
        const res = await ownerAgent.post('/api/shares').send({
            resource_type: 'project',
            resource_uid: project.uid,
            target_user_email: 'nobody@example.com',
            access_level: 'rw',
        });

        expect(res.status).not.toBe(400);
    });
});
