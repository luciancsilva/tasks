const request = require('supertest');
const app = require('../../app');
const { Project, Area, Task } = require('../../models');
const { createTestUser } = require('../helpers/testUtils');

describe('Templates Routes', () => {
    let user, area, agent, sourceProject;

    beforeEach(async () => {
        user = await createTestUser({ email: 'test@example.com' });

        area = await Area.create({ name: 'Work', user_id: user.id });

        sourceProject = await Project.create({
            name: 'Launch Plan',
            description: 'A project to templatize',
            status: 'in_progress',
            area_id: area.id,
            user_id: user.id,
        });

        const parent = await Task.create({
            name: 'Kickoff',
            user_id: user.id,
            project_id: sourceProject.id,
            recurrence_type: 'none',
            status: Task.STATUS.IN_PROGRESS,
            due_date: '2026-08-01T00:00:00.000Z',
        });

        await Task.create({
            name: 'Prepare deck',
            user_id: user.id,
            project_id: sourceProject.id,
            parent_task_id: parent.id,
            recurrence_type: 'none',
            status: Task.STATUS.DONE,
            due_date: '2026-08-03T00:00:00.000Z',
        });

        agent = request.agent(app);
        await agent.post('/api/login').send({
            email: 'test@example.com',
            password: 'password123',
        });
    });

    describe('POST /api/project/:uid/save-as-template', () => {
        it('saves an existing project as a template with its tasks', async () => {
            const res = await agent
                .post(`/api/project/${sourceProject.uid}/save-as-template`)
                .send({ name: 'Launch Template', category: 'work' });

            expect(res.status).toBe(201);
            expect(res.body.is_template).toBe(true);
            expect(res.body.name).toBe('Launch Template');
            expect(res.body.template_category).toBe('work');

            const template = await Project.findOne({
                where: { uid: res.body.uid },
            });
            expect(template.is_template).toBe(true);

            const copied = await Task.findAll({
                where: { project_id: template.id },
            });
            // parent + subtask copied
            expect(copied.length).toBe(2);
            // status reset when saving as template
            copied.forEach((t) => expect(t.status).toBe(0));
        });

        it('requires authentication', async () => {
            const res = await request(app)
                .post(`/api/project/${sourceProject.uid}/save-as-template`)
                .send({ name: 'X' });
            expect(res.status).toBe(401);
        });

        it('404s for a project the user does not own', async () => {
            const other = await createTestUser({ email: 'other@example.com' });
            const otherProject = await Project.create({
                name: 'Not mine',
                user_id: other.id,
            });
            const res = await agent
                .post(`/api/project/${otherProject.uid}/save-as-template`)
                .send({ name: 'X' });
            expect(res.status).toBe(404);
        });
    });

    describe('GET /api/templates', () => {
        it('lists only the user templates', async () => {
            await agent
                .post(`/api/project/${sourceProject.uid}/save-as-template`)
                .send({ name: 'Launch Template' });

            const res = await agent.get('/api/templates');
            expect(res.status).toBe(200);
            expect(res.body.templates).toHaveLength(1);
            expect(res.body.templates[0].name).toBe('Launch Template');
            // the regular source project must not appear
            expect(
                res.body.templates.every((t) => t.is_template === true)
            ).toBe(true);
        });
    });

    describe('POST /api/template/:uid/clone', () => {
        let templateUid;

        beforeEach(async () => {
            const saved = await agent
                .post(`/api/project/${sourceProject.uid}/save-as-template`)
                .send({ name: 'Launch Template' });
            templateUid = saved.body.uid;
        });

        it('clones a template into a new project offsetting due dates', async () => {
            const startDate = '2026-09-10T00:00:00.000Z';
            const res = await agent
                .post(`/api/template/${templateUid}/clone`)
                .send({ name: 'Q4 Launch', startDate });

            expect(res.status).toBe(201);
            expect(res.body.is_template).toBe(false);
            expect(res.body.name).toBe('Q4 Launch');

            const clone = await Project.findOne({
                where: { uid: res.body.uid },
            });
            expect(clone.source_template_id).not.toBeNull();

            const template = await Project.findOne({
                where: { uid: templateUid },
            });
            expect(clone.source_template_id).toBe(template.id);
            expect(template.clone_count).toBe(1);

            const tasks = await Task.findAll({
                where: { project_id: clone.id },
                order: [['due_date', 'ASC']],
            });
            // parent + subtask preserved
            expect(tasks.length).toBe(2);
            expect(tasks.some((t) => t.parent_task_id !== null)).toBe(true);

            // earliest due date (2026-08-01) shifted to startDate; the 2-day
            // gap to the subtask (2026-08-03) is preserved.
            const dueDates = tasks
                .map((t) => t.due_date && new Date(t.due_date).toISOString())
                .sort();
            expect(dueDates[0]).toBe(startDate);
            expect(dueDates[1]).toBe('2026-09-12T00:00:00.000Z');
        });
    });

    describe('DELETE /api/template/:uid', () => {
        it('deletes a template and its tasks', async () => {
            const saved = await agent
                .post(`/api/project/${sourceProject.uid}/save-as-template`)
                .send({ name: 'Launch Template' });
            const templateUid = saved.body.uid;
            const template = await Project.findOne({
                where: { uid: templateUid },
            });

            const res = await agent.delete(`/api/template/${templateUid}`);
            expect(res.status).toBe(200);

            const gone = await Project.findOne({
                where: { uid: templateUid },
            });
            expect(gone).toBeNull();

            const tasks = await Task.findAll({
                where: { project_id: template.id },
            });
            expect(tasks.length).toBe(0);
        });
    });
});
