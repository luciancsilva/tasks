const request = require('supertest');
const app = require('../../app');
const { Project, Task } = require('../../models');
const { createTestUser } = require('../helpers/testUtils');

describe('Projects — sequential vs parallel execution_mode (plan 53a)', () => {
    let user, agent;

    beforeEach(async () => {
        const email =
            'sequential-' +
            Date.now() +
            '-' +
            Math.random().toString(36).slice(2) +
            '@example.com';
        user = await createTestUser({ email });

        agent = request.agent(app);
        await agent.post('/api/login').send({
            email,
            password: 'password123',
        });
    });

    describe('execution_mode persistence', () => {
        it('legacy/default project is parallel', async () => {
            const project = await Project.create({
                name: 'Legacy project',
                user_id: user.id,
            });

            expect(project.execution_mode).toBe('parallel');
        });

        it('POST /api/project accepts execution_mode=sequential', async () => {
            const response = await agent.post('/api/project').send({
                name: 'Sequential project',
                execution_mode: 'sequential',
            });

            expect(response.status).toBe(201);
            expect(response.body.execution_mode).toBe('sequential');
        });

        it('PATCH /api/project/:uid persists execution_mode', async () => {
            const createRes = await agent.post('/api/project').send({
                name: 'Toggle me',
            });
            expect(createRes.body.execution_mode).toBe('parallel');

            const patchRes = await agent
                .patch(`/api/project/${createRes.body.uid}`)
                .send({ execution_mode: 'sequential' });

            expect(patchRes.status).toBe(200);
            expect(patchRes.body.execution_mode).toBe('sequential');

            const getRes = await agent.get(
                `/api/project/${createRes.body.uid}`
            );
            expect(getRes.body.execution_mode).toBe('sequential');
        });

        it('invalid execution_mode is rejected with 400', async () => {
            const response = await agent.post('/api/project').send({
                name: 'Bad mode',
                execution_mode: 'bogus',
            });

            expect(response.status).toBe(400);
        });
    });

    describe('GET /api/tasks?type=today — sequential visibility', () => {
        let sequentialProject, parallelProject;

        beforeEach(async () => {
            sequentialProject = await Project.create({
                name: 'Sequential proj',
                user_id: user.id,
                execution_mode: 'sequential',
            });
            parallelProject = await Project.create({
                name: 'Parallel proj',
                user_id: user.id,
                execution_mode: 'parallel',
            });
        });

        it('shows only the first not-done task of a sequential project', async () => {
            const t1 = await Task.create({
                name: 'Seq T1',
                user_id: user.id,
                project_id: sequentialProject.id,
                status: Task.STATUS.PLANNED,
                order: 1,
            });
            const t2 = await Task.create({
                name: 'Seq T2',
                user_id: user.id,
                project_id: sequentialProject.id,
                status: Task.STATUS.PLANNED,
                order: 2,
            });

            const response = await agent.get('/api/tasks?type=today');

            expect(response.status).toBe(200);
            const ids = response.body.tasks.map((t) => t.id);
            expect(ids).toContain(t1.id);
            expect(ids).not.toContain(t2.id);
        });

        it('completing the first task reveals the next one', async () => {
            const t1 = await Task.create({
                name: 'Seq T1',
                user_id: user.id,
                project_id: sequentialProject.id,
                status: Task.STATUS.PLANNED,
                order: 1,
            });
            const t2 = await Task.create({
                name: 'Seq T2',
                user_id: user.id,
                project_id: sequentialProject.id,
                status: Task.STATUS.PLANNED,
                order: 2,
            });

            await agent.patch(`/api/task/${t1.uid}`).send({ status: 'done' });

            const response = await agent.get('/api/tasks?type=today');

            expect(response.status).toBe(200);
            const ids = response.body.tasks.map((t) => t.id);
            expect(ids).not.toContain(t1.id);
            expect(ids).toContain(t2.id);
        });

        it('parallel project shows all active tasks', async () => {
            const p1 = await Task.create({
                name: 'Par T1',
                user_id: user.id,
                project_id: parallelProject.id,
                status: Task.STATUS.PLANNED,
                order: 1,
            });
            const p2 = await Task.create({
                name: 'Par T2',
                user_id: user.id,
                project_id: parallelProject.id,
                status: Task.STATUS.PLANNED,
                order: 2,
            });

            const response = await agent.get('/api/tasks?type=today');

            expect(response.status).toBe(200);
            const ids = response.body.tasks.map((t) => t.id);
            expect(ids).toContain(p1.id);
            expect(ids).toContain(p2.id);
        });

        it('type=all shows every task of a sequential project, not just next', async () => {
            const t1 = await Task.create({
                name: 'Seq T1',
                user_id: user.id,
                project_id: sequentialProject.id,
                status: Task.STATUS.PLANNED,
                order: 1,
            });
            const t2 = await Task.create({
                name: 'Seq T2',
                user_id: user.id,
                project_id: sequentialProject.id,
                status: Task.STATUS.PLANNED,
                order: 2,
            });

            const response = await agent.get('/api/tasks?type=all');

            expect(response.status).toBe(200);
            const ids = response.body.tasks.map((t) => t.id);
            expect(ids).toContain(t1.id);
            expect(ids).toContain(t2.id);
        });

        it('browsing the project directly (project_uid) shows every task', async () => {
            const t1 = await Task.create({
                name: 'Seq T1',
                user_id: user.id,
                project_id: sequentialProject.id,
                status: Task.STATUS.PLANNED,
                order: 1,
            });
            const t2 = await Task.create({
                name: 'Seq T2',
                user_id: user.id,
                project_id: sequentialProject.id,
                status: Task.STATUS.PLANNED,
                order: 2,
            });

            const response = await agent.get(
                `/api/tasks?type=today&project_uid=${sequentialProject.uid}`
            );

            expect(response.status).toBe(200);
            const ids = response.body.tasks.map((t) => t.id);
            expect(ids).toContain(t1.id);
            expect(ids).toContain(t2.id);
        });
    });

    describe('Stalled logic unaffected by execution_mode', () => {
        it('sequential project with 0 active tasks is stalled', async () => {
            const project = await Project.create({
                name: 'Empty sequential',
                user_id: user.id,
                execution_mode: 'sequential',
                status: 'in_progress',
            });

            const response = await agent.get('/api/projects');

            expect(response.status).toBe(200);
            const found = response.body.projects.find(
                (p) => p.id === project.id
            );
            expect(found.is_stalled).toBe(true);
        });

        it('sequential project with all tasks done is stalled', async () => {
            const project = await Project.create({
                name: 'Done sequential',
                user_id: user.id,
                execution_mode: 'sequential',
                status: 'in_progress',
            });
            await Task.create({
                name: 'Done task',
                user_id: user.id,
                project_id: project.id,
                status: Task.STATUS.DONE,
            });

            const response = await agent.get('/api/projects');

            expect(response.status).toBe(200);
            const found = response.body.projects.find(
                (p) => p.id === project.id
            );
            expect(found.is_stalled).toBe(true);
        });
    });
});
