const bcrypt = require('bcrypt');
const {
    sequelize,
    User,
    Task,
    CalDAVCalendar,
    CalDAVSyncState,
} = require('../../models');
const MergePhase = require('../../modules/caldav/sync/merge-phase');
const SyncStateRepository = require('../../modules/caldav/repositories/sync-state-repository');

// Verifies the atomicity added in plans/19d: if the sync-state write fails
// right after a task is created from a remote change, the task creation must
// roll back so the next sync does not recreate it as a duplicate (etag was
// never stored).
describe('MergePhase create rollback (plans/19d)', () => {
    let testUser;
    let calendar;
    const mergePhase = new MergePhase();

    beforeAll(async () => {
        await sequelize.sync({ force: true });
    });

    beforeEach(async () => {
        testUser = await User.create({
            email: 'merge-rollback@test.com',
            password_digest: await bcrypt.hash('password', 10),
            verified: true,
        });
        calendar = await CalDAVCalendar.create({
            uid: 'merge-rollback-cal',
            user_id: testUser.id,
            name: 'Cal',
            enabled: true,
            sync_direction: 'bidirectional',
            sync_interval_minutes: 15,
            conflict_resolution: 'last_write_wins',
        });
    });

    afterEach(async () => {
        await CalDAVSyncState.destroy({ where: {} });
        await CalDAVCalendar.destroy({ where: {} });
        await Task.destroy({ where: {} });
        await User.destroy({ where: {} });
        jest.restoreAllMocks();
    });

    afterAll(async () => {
        await sequelize.close();
    });

    const change = {
        action: 'create_or_update',
        href: '/calendars/test/tasks/remote-1.ics',
        etag: '"etag-1"',
        task: { uid: 'remote-task-1', name: 'Remote Task 1' },
    };

    it('rolls back the created task when the sync-state write fails', async () => {
        jest.spyOn(SyncStateRepository, 'createOrUpdate').mockRejectedValue(
            new Error('injected sync-state failure')
        );

        const results = await mergePhase.execute(calendar, [change]);

        expect(results.errors).toHaveLength(1);
        expect(results.merged).toHaveLength(0);

        const tasks = await Task.findAll({
            where: { uid: 'remote-task-1', user_id: testUser.id },
        });
        expect(tasks).toHaveLength(0);
    });

    it('commits task and sync-state together on success', async () => {
        const results = await mergePhase.execute(calendar, [change]);

        expect(results.errors).toHaveLength(0);
        expect(results.merged).toHaveLength(1);

        const task = await Task.findOne({
            where: { uid: 'remote-task-1', user_id: testUser.id },
        });
        expect(task).not.toBeNull();

        const syncState = await SyncStateRepository.findByTaskAndCalendar(
            task.id,
            calendar.id
        );
        expect(syncState).not.toBeNull();
        expect(syncState.etag).toBe('"etag-1"');
    });
});
