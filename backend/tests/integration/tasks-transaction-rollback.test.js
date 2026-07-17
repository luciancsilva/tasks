const { Task, Tag } = require('../../models');
const tasksService = require('../../modules/tasks/service');
const taskRepository = require('../../modules/tasks/repository');
const { createTestUser } = require('../helpers/testUtils');

// Verifies the atomicity added in plans/19a: when a dependent write inside
// tasksService.create fails, the whole operation (task row + tags + subtasks)
// must roll back, leaving nothing half-written.
describe('tasksService.create transactional rollback (plans/19a)', () => {
    let testUser;

    beforeEach(async () => {
        await Task.destroy({ where: {}, truncate: true });
        await Tag.destroy({ where: {}, truncate: true });
        testUser = await createTestUser();
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('rolls back the task and its tags when subtask creation fails', async () => {
        // createSubtasks -> taskRepository.createMany. Force it to fail so the
        // failure surfaces after the task row and tags were already written
        // inside the same transaction.
        const spy = jest
            .spyOn(taskRepository, 'createMany')
            .mockRejectedValue(new Error('injected subtask failure'));

        await expect(
            tasksService.create(testUser.id, 'UTC', {
                name: 'Atomic task',
                status: Task.STATUS.NOT_STARTED,
                priority: Task.PRIORITY.MEDIUM,
                tags: [{ name: 'atomic-tag' }],
                subtasks: [{ name: 'child', isNew: true }],
            })
        ).rejects.toThrow('injected subtask failure');

        expect(spy).toHaveBeenCalled();

        // Nothing must have been committed: no task, and the tag link (and the
        // freshly-created tag) must not survive the rolled-back transaction.
        const tasks = await Task.findAll({
            where: { user_id: testUser.id, name: 'Atomic task' },
        });
        expect(tasks).toHaveLength(0);

        const tags = await Tag.findAll({
            where: { user_id: testUser.id, name: 'atomic-tag' },
        });
        expect(tags).toHaveLength(0);
    });

    it('commits task, tags and subtasks together on success', async () => {
        const result = await tasksService.create(testUser.id, 'UTC', {
            name: 'Happy task',
            status: Task.STATUS.NOT_STARTED,
            priority: Task.PRIORITY.MEDIUM,
            tags: [{ name: 'happy-tag' }],
            subtasks: [{ name: 'child', isNew: true }],
        });

        expect(result.task).toBeDefined();

        const parent = await Task.findOne({
            where: { user_id: testUser.id, name: 'Happy task' },
        });
        expect(parent).not.toBeNull();

        const subtasks = await Task.findAll({
            where: { user_id: testUser.id, parent_task_id: parent.id },
        });
        expect(subtasks).toHaveLength(1);

        const tags = await Tag.findAll({
            where: { user_id: testUser.id, name: 'happy-tag' },
        });
        expect(tags).toHaveLength(1);
    });
});
