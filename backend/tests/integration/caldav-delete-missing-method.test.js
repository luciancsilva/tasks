const bcrypt = require('bcrypt');
const axios = require('axios');
const {
    sequelize,
    User,
    Task,
    CalDAVCalendar,
    CalDAVRemoteCalendar,
    CalDAVSyncState,
} = require('../../models');
const MergePhase = require('../../modules/caldav/sync/merge-phase');
const PushPhase = require('../../modules/caldav/sync/push-phase');
const SyncStateRepository = require('../../modules/caldav/repositories/sync-state-repository');
const encryptionService = require('../../modules/caldav/services/encryption-service');

jest.mock('axios');

// Verifies SyncStateRepository.deleteByTaskId and its transactional use
// in MergePhase and PushPhase (plans/19l).
describe('CalDAV deleteByTaskId method and transactional deletions (plans/19l)', () => {
    let testUser;
    let calendar;
    let remoteCalendar;
    const mergePhase = new MergePhase();
    const pushPhase = new PushPhase();

    beforeAll(async () => {
        await sequelize.sync({ force: true });
    });

    beforeEach(async () => {
        testUser = await User.create({
            email: 'delete-missing@test.com',
            password_digest: await bcrypt.hash('password', 10),
            verified: true,
        });
        calendar = await CalDAVCalendar.create({
            uid: 'delete-missing-cal',
            user_id: testUser.id,
            name: 'DelCal',
            enabled: true,
            sync_direction: 'bidirectional',
            sync_interval_minutes: 15,
            conflict_resolution: 'last_write_wins',
        });
        remoteCalendar = await CalDAVRemoteCalendar.create({
            user_id: testUser.id,
            name: 'Remote Cal',
            calendar_id: calendar.id,
            server_url: 'https://caldav.example.com/dav/',
            calendar_path: '/user/tasks/',
            username: 'testuser',
            password_encrypted: encryptionService.encrypt('secret'),
            enabled: true,
        });
        jest.clearAllMocks();
    });

    afterEach(async () => {
        await CalDAVSyncState.destroy({ where: {} });
        await CalDAVRemoteCalendar.destroy({ where: {} });
        await CalDAVCalendar.destroy({ where: {} });
        await Task.destroy({ where: {} });
        await User.destroy({ where: {} });
        jest.restoreAllMocks();
    });

    afterAll(async () => {
        await sequelize.close();
    });

    describe('SyncStateRepository.deleteByTaskId', () => {
        it('deletes all sync states for a given taskId without throwing TypeError', async () => {
            const task = await Task.create({
                uid: 'task-sync-state-del',
                user_id: testUser.id,
                name: 'Test Task',
            });
            await CalDAVSyncState.create({
                last_modified: new Date(),
                task_id: task.id,
                calendar_id: calendar.id,
                etag: '"etag-unit"',
                last_synced_at: new Date(),
                sync_status: 'synced',
            });

            expect(typeof SyncStateRepository.deleteByTaskId).toBe('function');
            const deletedCount = await SyncStateRepository.deleteByTaskId(
                task.id
            );
            expect(deletedCount).toBe(1);

            const remaining = await CalDAVSyncState.findAll({
                where: { task_id: task.id },
            });
            expect(remaining).toHaveLength(0);
        });
    });

    describe('MergePhase handling of remote deletions', () => {
        it('deletes local task and corresponding CalDAVSyncState when remote deletion occurs without TypeError', async () => {
            const task = await Task.create({
                uid: 'remote-deleted-task',
                user_id: testUser.id,
                name: 'To be remotely deleted',
            });
            await CalDAVSyncState.create({
                last_modified: new Date(),
                task_id: task.id,
                calendar_id: calendar.id,
                etag: '"etag-old"',
                last_synced_at: new Date(Date.now() + 60000), // ensure no conflict detection
                sync_status: 'synced',
            });

            const change = {
                action: 'delete',
                href: '/calendars/test/tasks/remote-deleted-task.ics',
            };

            const results = await mergePhase.execute(calendar, [change]);
            expect(results.errors).toHaveLength(0);
            expect(results.deleted).toHaveLength(1);

            // (a) a tarefa é apagada
            const foundTask = await Task.findByPk(task.id);
            expect(foundTask).toBeNull();

            // (b) o CalDAVSyncState correspondente some
            const foundSyncState = await CalDAVSyncState.findOne({
                where: { task_id: task.id },
            });
            expect(foundSyncState).toBeNull();
        });

        it('rolls back task deletion if deleteByTaskId fails during merge phase', async () => {
            const task = await Task.create({
                uid: 'rollback-task-del',
                user_id: testUser.id,
                name: 'Should rollback on error',
            });
            await CalDAVSyncState.create({
                last_modified: new Date(),
                task_id: task.id,
                calendar_id: calendar.id,
                etag: '"etag-rollback"',
                last_synced_at: new Date(Date.now() + 60000),
                sync_status: 'synced',
            });

            jest.spyOn(SyncStateRepository, 'deleteByTaskId').mockRejectedValue(
                new Error('injected deleteByTaskId failure')
            );

            const change = {
                action: 'delete',
                href: '/calendars/test/tasks/rollback-task-del.ics',
            };

            const results = await mergePhase.execute(calendar, [change]);
            expect(results.errors).toHaveLength(1);
            expect(results.deleted).toHaveLength(0);

            // (a) destroy da tarefa fez rollback
            const foundTask = await Task.findByPk(task.id);
            expect(foundTask).not.toBeNull();

            // (b) syncState do task continua lá
            const foundSyncState = await CalDAVSyncState.findOne({
                where: { task_id: task.id },
            });
            expect(foundSyncState).not.toBeNull();
        });
    });

    describe('PushPhase handling of local task deletion to remote', () => {
        it('deletes sync state after successfully deleting task from remote CalDAV server', async () => {
            const task = await Task.create({
                uid: 'push-delete-task',
                user_id: testUser.id,
                name: 'Push delete',
            });
            await CalDAVSyncState.create({
                last_modified: new Date(),
                task_id: task.id,
                calendar_id: calendar.id,
                etag: '"etag-push"',
                last_synced_at: new Date(),
                sync_status: 'synced',
            });

            axios.mockResolvedValue({ status: 204 });

            const result = await pushPhase.deleteTaskFromRemote(
                task,
                remoteCalendar,
                calendar
            );
            expect(result.action).toBe('delete');

            const foundSyncState = await CalDAVSyncState.findOne({
                where: { task_id: task.id },
            });
            expect(foundSyncState).toBeNull();
        });

        it('deletes sync state when remote CalDAV server returns 404', async () => {
            const task = await Task.create({
                uid: 'push-delete-404-task',
                user_id: testUser.id,
                name: 'Push delete 404',
            });
            await CalDAVSyncState.create({
                last_modified: new Date(),
                task_id: task.id,
                calendar_id: calendar.id,
                etag: '"etag-push-404"',
                last_synced_at: new Date(),
                sync_status: 'synced',
            });

            axios.mockRejectedValue({
                response: { status: 404 },
            });

            const result = await pushPhase.deleteTaskFromRemote(
                task,
                remoteCalendar,
                calendar
            );
            expect(result.action).toBe('delete');
            expect(result.alreadyDeleted).toBe(true);

            const foundSyncState = await CalDAVSyncState.findOne({
                where: { task_id: task.id },
            });
            expect(foundSyncState).toBeNull();
        });
    });
});
