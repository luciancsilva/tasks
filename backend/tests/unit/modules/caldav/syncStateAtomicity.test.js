'use strict';

const SyncStateRepository = require('../../../../modules/caldav/repositories/sync-state-repository');
const {
    CalDAVSyncState,
    CalDAVCalendar,
    Task,
    User,
    sequelize,
} = require('../../../../models');
const bcrypt = require('bcrypt');

describe('SyncStateRepository - createOrUpdate and resolveConflict transaction propagation (plan 42)', () => {
    let user, task, calendar;

    beforeEach(async () => {
        user = await User.create({
            email: `caldav_atom_${Date.now()}@test.com`,
            password_digest: await bcrypt.hash('pass', 10),
        });
        task = await Task.create({
            name: 'CalDAV Task',
            user_id: user.id,
            status: 0,
        });
        calendar = await CalDAVCalendar.create({
            user_id: user.id,
            name: 'Test Calendar',
            url: 'http://example.com/caldav/calendar',
            ctag: 'ctag1',
            sync_token: 'token1',
        });
    });

    it('createOrUpdate passes options to findByTaskAndCalendar (reads inside transaction)', async () => {
        // Create a sync state
        await SyncStateRepository.create({
            task_id: task.id,
            calendar_id: calendar.id,
            etag: 'abc',
            sync_status: 'synced',
            last_synced_at: new Date(),
            last_modified: new Date(),
        });

        // Inside a transaction, update should find the existing row and update it
        let updated;
        await sequelize.transaction(async (t) => {
            updated = await SyncStateRepository.createOrUpdate(
                task.id,
                calendar.id,
                { etag: 'xyz', sync_status: 'synced' },
                { transaction: t }
            );
        });

        const row = await CalDAVSyncState.findOne({
            where: { task_id: task.id, calendar_id: calendar.id },
        });
        expect(row.etag).toBe('xyz');
    });

    it('resolveConflict passes options to findByTaskAndCalendar', async () => {
        await SyncStateRepository.create({
            task_id: task.id,
            calendar_id: calendar.id,
            etag: 'etag1',
            sync_status: 'conflict',
            last_synced_at: new Date(),
            last_modified: new Date(),
        });

        await sequelize.transaction(async (t) => {
            await SyncStateRepository.resolveConflict(
                task.id,
                calendar.id,
                'local',
                { transaction: t }
            );
        });

        const row = await CalDAVSyncState.findOne({
            where: { task_id: task.id, calendar_id: calendar.id },
        });
        expect(row.sync_status).toBe('synced');
    });
});
