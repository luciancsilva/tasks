const request = require('supertest');
const app = require('../../app');
const { Task, sequelize } = require('../../models');
const { createTestUser } = require('../helpers/testUtils');

// Sequelize's timestamp hook always overwrites `updatedAt` on create/save
// (silent:true just skips the column instead of applying a custom value),
// so backdating a task requires a raw UPDATE.
async function ageTask(task, days) {
    await sequelize.query('UPDATE tasks SET updated_at = :ts WHERE id = :id', {
        replacements: {
            ts: new Date(Date.now() - days * 86400000).toISOString(),
            id: task.id,
        },
    });
}

describe('Tasks — stale detection (plan 56)', () => {
    let user, agent;

    beforeEach(async () => {
        const email =
            'stale-' +
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

    describe('GET /api/tasks?type=stale', () => {
        it('returns tasks not updated in stale_days', async () => {
            const staleTask = await Task.create({
                name: 'Esquecida',
                user_id: user.id,
                status: Task.STATUS.NOT_STARTED,
            });
            await ageTask(staleTask, 40);
            const recentTask = await Task.create({
                name: 'Recente',
                user_id: user.id,
                status: Task.STATUS.NOT_STARTED,
            });
            await ageTask(recentTask, 10);

            const response = await agent.get(
                '/api/tasks?type=stale&stale_days=30'
            );

            expect(response.status).toBe(200);
            const ids = response.body.tasks.map((t) => t.id);
            expect(ids).toContain(staleTask.id);
            expect(ids).not.toContain(recentTask.id);
        });

        it('excludes done tasks even if old', async () => {
            const doneTask = await Task.create({
                name: 'Feita há muito',
                user_id: user.id,
                status: Task.STATUS.DONE,
            });
            await ageTask(doneTask, 100);

            const response = await agent.get(
                '/api/tasks?type=stale&stale_days=30'
            );

            expect(response.status).toBe(200);
            const ids = response.body.tasks.map((t) => t.id);
            expect(ids).not.toContain(doneTask.id);
        });

        it('excludes archived tasks', async () => {
            const archivedTask = await Task.create({
                name: 'Arquivada',
                user_id: user.id,
                status: Task.STATUS.ARCHIVED,
            });
            await ageTask(archivedTask, 100);

            const response = await agent.get(
                '/api/tasks?type=stale&stale_days=30'
            );

            expect(response.status).toBe(200);
            const ids = response.body.tasks.map((t) => t.id);
            expect(ids).not.toContain(archivedTask.id);
        });

        it('excludes recurring instances but keeps stale parent', async () => {
            const parent = await Task.create({
                name: 'Recorrente pai',
                user_id: user.id,
                status: Task.STATUS.NOT_STARTED,
                recurrence_type: 'daily',
            });
            await ageTask(parent, 100);
            const instance = await Task.create({
                name: 'Instância',
                user_id: user.id,
                status: Task.STATUS.NOT_STARTED,
                recurring_parent_id: parent.id,
            });
            await ageTask(instance, 100);

            const response = await agent.get(
                '/api/tasks?type=stale&stale_days=30'
            );

            expect(response.status).toBe(200);
            const ids = response.body.tasks.map((t) => t.id);
            expect(ids).toContain(parent.id);
            expect(ids).not.toContain(instance.id);
        });

        it('excludes someday tasks', async () => {
            const somedayTask = await Task.create({
                name: 'Someday',
                user_id: user.id,
                status: Task.STATUS.NOT_STARTED,
                is_someday: true,
            });
            await ageTask(somedayTask, 100);

            const response = await agent.get(
                '/api/tasks?type=stale&stale_days=30'
            );

            expect(response.status).toBe(200);
            const ids = response.body.tasks.map((t) => t.id);
            expect(ids).not.toContain(somedayTask.id);
        });

        it('excludes habit tasks', async () => {
            const habitTask = await Task.create({
                name: 'Hábito',
                user_id: user.id,
                status: Task.STATUS.NOT_STARTED,
                habit_mode: true,
            });
            await ageTask(habitTask, 100);

            const response = await agent.get(
                '/api/tasks?type=stale&stale_days=30'
            );

            expect(response.status).toBe(200);
            const ids = response.body.tasks.map((t) => t.id);
            expect(ids).not.toContain(habitTask.id);
        });

        it('stale_days=0 returns 400', async () => {
            const response = await agent.get(
                '/api/tasks?type=stale&stale_days=0'
            );

            expect(response.status).toBe(400);
        });

        it('stale_days negative returns 400', async () => {
            const response = await agent.get(
                '/api/tasks?type=stale&stale_days=-5'
            );

            expect(response.status).toBe(400);
        });

        it('stale_days absent defaults to 30', async () => {
            const staleTask = await Task.create({
                name: 'Esquecida sem param',
                user_id: user.id,
                status: Task.STATUS.NOT_STARTED,
            });
            await ageTask(staleTask, 31);
            const withinDefault = await Task.create({
                name: 'Dentro do default',
                user_id: user.id,
                status: Task.STATUS.NOT_STARTED,
            });
            await ageTask(withinDefault, 20);

            const response = await agent.get('/api/tasks?type=stale');

            expect(response.status).toBe(200);
            const ids = response.body.tasks.map((t) => t.id);
            expect(ids).toContain(staleTask.id);
            expect(ids).not.toContain(withinDefault.id);
        });
    });
});
