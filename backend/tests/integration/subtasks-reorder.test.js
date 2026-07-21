const request = require('supertest');
const app = require('../../app');
const { Task } = require('../../models');
const { createTestUser } = require('../helpers/testUtils');

// Plan 64: PATCH /api/task/:uid/subtasks/reorder persists a new subtask order.
// Regression guard: the service originally checked getAccess against 'write'/
// 'owner', values getAccess never returns ('rw'/'admin'), so every call —
// including the owner's — threw ForbiddenError and the feature never worked.
describe('Subtask reorder (Plan 64)', () => {
    let user, agent, parent, sub1, sub2, sub3;

    beforeEach(async () => {
        user = await createTestUser({ email: 'reorder@example.com' });
        agent = request.agent(app);
        await agent
            .post('/api/login')
            .send({ email: 'reorder@example.com', password: 'password123' });

        parent = await Task.create({
            name: 'Parent',
            user_id: user.id,
            status: Task.STATUS.NOT_STARTED,
            priority: Task.PRIORITY.MEDIUM,
        });
        sub1 = await Task.create({
            name: 'Sub 1',
            user_id: user.id,
            parent_task_id: parent.id,
            order: 1,
        });
        sub2 = await Task.create({
            name: 'Sub 2',
            user_id: user.id,
            parent_task_id: parent.id,
            order: 2,
        });
        sub3 = await Task.create({
            name: 'Sub 3',
            user_id: user.id,
            parent_task_id: parent.id,
            order: 3,
        });
    });

    it('lets the owner reorder subtasks', async () => {
        const res = await agent
            .patch(`/api/task/${parent.uid}/subtasks/reorder`)
            .send({ subtaskIds: [sub3.uid, sub1.uid, sub2.uid] });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);

        await sub1.reload();
        await sub2.reload();
        await sub3.reload();
        expect(sub3.order).toBe(1);
        expect(sub1.order).toBe(2);
        expect(sub2.order).toBe(3);
    });

    it('denies a user with no access to the parent task', async () => {
        const other = await createTestUser({ email: 'other@example.com' });
        const otherAgent = request.agent(app);
        await otherAgent
            .post('/api/login')
            .send({ email: 'other@example.com', password: 'password123' });
        void other;

        const res = await otherAgent
            .patch(`/api/task/${parent.uid}/subtasks/reorder`)
            .send({ subtaskIds: [sub1.uid, sub2.uid, sub3.uid] });

        expect([403, 404]).toContain(res.status);
    });
});
