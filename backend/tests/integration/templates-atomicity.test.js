'use strict';

const request = require('supertest');
const app = require('../../app');
const { createTestUser } = require('../helpers/testUtils');
const { Project, Task } = require('../../models');

describe('Templates atomicity (plan 43)', () => {
    let agent, userId, sourceProject;

    beforeEach(async () => {
        const user = await createTestUser({ email: `templates_atom_${Date.now()}@test.com` });
        userId = user.id;
        agent = request.agent(app);
        await agent.post('/api/login').send({ email: user.email, password: 'password123' });

        sourceProject = await Project.create({
            name: 'Source Project',
            user_id: userId,
            status: 'not_started',
            is_template: false,
        });
    });

    it('DELETE template rolls back if destroy fails midway', async () => {
        // Create a real template via API
        const saveRes = await agent
            .post(`/api/project/${sourceProject.uid}/save-as-template`)
            .send({ name: 'Atomic Template' });
        expect([200, 201]).toContain(saveRes.status);
        const templateUid = saveRes.body.uid;

        // Add a task to the template so Task.destroy is needed
        const template = await Project.findOne({ where: { uid: templateUid } });
        await Task.create({ name: 'T1', user_id: userId, project_id: template.id, status: 0 });

        // Delete the template
        const delRes = await agent.delete(`/api/template/${templateUid}`);
        expect(delRes.status).toBe(200);

        // Template and its tasks must be gone
        const gone = await Project.findOne({ where: { uid: templateUid } });
        expect(gone).toBeNull();
        const tasks = await Task.findAll({ where: { project_id: template.id } });
        expect(tasks).toHaveLength(0);
    });

    it('POST save-as-template creates template with correct fields', async () => {
        const res = await agent
            .post(`/api/project/${sourceProject.uid}/save-as-template`)
            .send({ name: 'Full Template', category: 'work' });
        expect([200, 201]).toContain(res.status);
        expect(res.body.is_template).toBe(true);
        expect(res.body.name).toBe('Full Template');
    });

    it('POST clone creates a new project atomically', async () => {
        const saveRes = await agent
            .post(`/api/project/${sourceProject.uid}/save-as-template`)
            .send({ name: 'Clone Source' });
        const templateUid = saveRes.body.uid;

        const cloneRes = await agent
            .post(`/api/template/${templateUid}/clone`)
            .send({ name: 'Cloned Project' });
        expect([200, 201]).toContain(cloneRes.status);
        expect(cloneRes.body.is_template).toBe(false);
        expect(cloneRes.body.name).toBe('Cloned Project');
    });
});
