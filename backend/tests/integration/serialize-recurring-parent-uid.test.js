const { Task } = require('../../models');
const {
    serializeTask,
    serializeTasks,
} = require('../../modules/tasks/core/serializers');
const { createTestUser } = require('../helpers/testUtils');

// Plan 72: serializeTasks batch-fetches recurring parent UIDs into a single
// map instead of issuing one findById per task (N+1). These tests assert the
// batched path resolves recurring_parent_uid identically to the per-task path.
describe('serializeTasks — recurring_parent_uid batching (Plan 72)', () => {
    let user;

    beforeEach(async () => {
        user = await createTestUser({ email: 'serial-parent@example.com' });
    });

    it('resolves recurring_parent_uid for multiple children sharing one parent', async () => {
        const parent = await Task.create({
            name: 'Parent Template',
            user_id: user.id,
            recurrence_type: 'daily',
            recurrence_interval: 1,
            recurring_parent_id: null,
            status: Task.STATUS.NOT_STARTED,
            priority: Task.PRIORITY.MEDIUM,
        });

        const child1 = await Task.create({
            name: 'Child 1',
            user_id: user.id,
            recurring_parent_id: parent.id,
            status: Task.STATUS.NOT_STARTED,
            priority: Task.PRIORITY.MEDIUM,
        });
        const child2 = await Task.create({
            name: 'Child 2',
            user_id: user.id,
            recurring_parent_id: parent.id,
            status: Task.STATUS.NOT_STARTED,
            priority: Task.PRIORITY.MEDIUM,
        });

        const result = await serializeTasks([child1, child2], 'UTC');

        expect(result).toHaveLength(2);
        expect(result[0].recurring_parent_uid).toBe(parent.uid);
        expect(result[1].recurring_parent_uid).toBe(parent.uid);
    });

    it('returns null recurring_parent_uid for a non-recurring task', async () => {
        const standalone = await Task.create({
            name: 'Standalone',
            user_id: user.id,
            recurring_parent_id: null,
            status: Task.STATUS.NOT_STARTED,
            priority: Task.PRIORITY.MEDIUM,
        });

        const result = await serializeTasks([standalone], 'UTC');

        expect(result[0].recurring_parent_uid).toBeNull();
    });

    it('serializeTask (single, no map) still resolves the parent uid via findById', async () => {
        const parent = await Task.create({
            name: 'Parent Template',
            user_id: user.id,
            recurrence_type: 'daily',
            recurrence_interval: 1,
            recurring_parent_id: null,
            status: Task.STATUS.NOT_STARTED,
            priority: Task.PRIORITY.MEDIUM,
        });
        const child = await Task.create({
            name: 'Lone Child',
            user_id: user.id,
            recurring_parent_id: parent.id,
            status: Task.STATUS.NOT_STARTED,
            priority: Task.PRIORITY.MEDIUM,
        });

        // No parentUidMap passed → exercises the findById fallback branch.
        const result = await serializeTask(child, 'UTC');

        expect(result.recurring_parent_uid).toBe(parent.uid);
    });
});
