const request = require('supertest');
const app = require('../../app');
const { Area, Goal, InboxItem, Project, Task, User } = require('../../models');
const { createTestUser } = require('../helpers/testUtils');

const DAY = 24 * 60 * 60 * 1000;

describe('Reviews Sections aggregation (54b)', () => {
    let user, agent, area;

    beforeEach(async () => {
        user = await createTestUser({
            email: 'review-sections@example.com',
        });
        agent = request.agent(app);
        await agent.post('/api/login').send({
            email: 'review-sections@example.com',
            password: 'password123',
        });
        area = await Area.create({ name: 'Area', user_id: user.id });
    });

    const sections = async () => {
        const res = await agent.get('/api/reviews/sections');
        expect(res.status).toBe(200);
        return res.body.sections;
    };

    const byId = (list, id) => list.find((s) => s.id === id);

    it('returns 7 sections all ready with counts', async () => {
        const list = await sections();
        expect(list).toHaveLength(7);
        list.forEach((s) => expect(s.ready).toBe(true));
    });

    it('inbox counts only added items', async () => {
        await InboxItem.create({
            content: 'a1',
            status: 'added',
            source: 'test',
            user_id: user.id,
        });
        await InboxItem.create({
            content: 'a2',
            status: 'added',
            source: 'test',
            user_id: user.id,
        });
        await InboxItem.create({
            content: 'p1',
            status: 'processed',
            source: 'test',
            user_id: user.id,
        });
        const list = await sections();
        expect(byId(list, 'inbox').count).toBe(2);
    });

    it('stale includes tasks older than stale_days and excludes recent', async () => {
        const oldTask = await Task.create({
            name: 'stale-old',
            user_id: user.id,
            status: 0,
        });
        const freshTask = await Task.create({
            name: 'fresh',
            user_id: user.id,
            status: 0,
        });
        const oldDate = new Date(Date.now() - 40 * DAY).toISOString();
        const freshDate = new Date(Date.now() - 10 * DAY).toISOString();
        await Task.sequelize.query(
            `UPDATE tasks SET updated_at = ? WHERE id = ?`,
            { replacements: [oldDate, oldTask.id] }
        );
        await Task.sequelize.query(
            `UPDATE tasks SET updated_at = ? WHERE id = ?`,
            { replacements: [freshDate, freshTask.id] }
        );
        const list = await sections();
        const stale = byId(list, 'stale');
        expect(stale.count).toBe(1);
        expect(stale.items[0].meta.days_stale).toBeGreaterThanOrEqual(39);
    });

    it('stalled flags in_progress projects with no active tasks', async () => {
        const stalledProject = await Project.create({
            name: 'Stalled',
            user_id: user.id,
            status: 'in_progress',
        });
        const activeProject = await Project.create({
            name: 'Active',
            user_id: user.id,
            status: 'in_progress',
        });
        await Task.create({
            name: 'active task',
            user_id: user.id,
            project_id: activeProject.id,
            status: 0,
        });
        const list = await sections();
        const stalled = byId(list, 'stalled');
        expect(stalled.count).toBe(1);
        expect(stalled.items[0].uid).toBe(stalledProject.uid);
    });

    it('waiting lists waiting tasks with waiting_since_days', async () => {
        await Task.create({
            name: 'waiting task',
            user_id: user.id,
            status: 4,
            waiting_since: new Date(Date.now() - 10 * DAY),
        });
        const list = await sections();
        const waiting = byId(list, 'waiting');
        expect(waiting.count).toBe(1);
        expect(waiting.items[0].meta.waiting_since_days).toBeGreaterThanOrEqual(
            9
        );
    });

    it('someday lists is_someday tasks', async () => {
        await Task.create({
            name: 'someday task',
            user_id: user.id,
            status: 0,
            is_someday: true,
        });
        await Task.create({
            name: 'normal task',
            user_id: user.id,
            status: 0,
            is_someday: false,
        });
        const list = await sections();
        expect(byId(list, 'someday').count).toBe(1);
    });

    it('goals lists active goals', async () => {
        await Goal.create({
            title: 'Active goal',
            area_id: area.id,
            user_id: user.id,
            status: 'active',
        });
        await Goal.create({
            title: 'Done goal',
            area_id: area.id,
            user_id: user.id,
            status: 'done',
        });
        const list = await sections();
        const goals = byId(list, 'goals');
        expect(goals.count).toBe(1);
        expect(goals.items[0].name).toBe('Active goal');
    });

    it('upcoming includes tasks due within 7d and excludes beyond', async () => {
        await Task.create({
            name: 'due in 3d',
            user_id: user.id,
            status: 0,
            due_date: new Date(Date.now() + 3 * DAY),
        });
        await Task.create({
            name: 'due in 10d',
            user_id: user.id,
            status: 0,
            due_date: new Date(Date.now() + 10 * DAY),
        });
        const list = await sections();
        expect(byId(list, 'upcoming').count).toBe(1);
    });

    it('requires authentication', async () => {
        const res = await request(app).get('/api/reviews/sections');
        expect(res.status).toBe(401);
    });
});
