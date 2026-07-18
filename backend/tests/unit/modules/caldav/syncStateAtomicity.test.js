'use strict';

const SyncStateRepository = require('../../../modules/caldav/repositories/sync-state-repository');
const { CalDAVSyncState, Task, User, sequelize } = require('../../../models');
const bcrypt = require('bcrypt');

describe('SyncStateRepository - createOrUpdate and resolveConflict transaction propagation (plan 42)', () => {
    let user, task;

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
    });

    it('createOrUpdate passes options to findByTaskAndCalendar (reads inside transaction)', async () => {
        // Create a sync state
        await SyncStateRepository.create({
            task_id: task.id,
            calendar_id: 999,
            etag: 'abc',
            sync_status: 'synced',
            last_synced_at: new Date(),
        });

        // Inside a transaction, update should find the existing row and update it
        let updated;
        await sequelize.transaction(async (t) => {
            updated = await SyncStateRepository.createOrUpdate(
                task.id,
                999,
                { etag: 'xyz', sync_status: 'synced' },
                { transaction: t }
            );
        });

        const row = await CalDAVSyncState.findOne({ where: { task_id: task.id, calendar_id: 999 } });
        expect(row.etag).toBe('xyz');
    });

    it('resolveConflict passes options to findByTaskAndCalendar', async () => {
        await SyncStateRepository.create({
            task_id: task.id,
            calendar_id: 888,
            etag: 'etag1',
            sync_status: 'conflict',
            last_synced_at: new Date(),
        });

        await sequelize.transaction(async (t) => {
            await SyncStateRepository.resolveConflict(task.id, 888, 'local', { transaction: t });
        });

        const row = await CalDAVSyncState.findOne({ where: { task_id: task.id, calendar_id: 888 } });
        expect(row.sync_status).toBe('synced');
    });
});
