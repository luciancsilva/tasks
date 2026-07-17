const bcrypt = require('bcrypt');
const {
    sequelize,
    User,
    Task,
    CalDAVCalendar,
    CalDAVSyncState,
} = require('../../models');
const SyncStateRepository = require('../../modules/caldav/repositories/sync-state-repository');
const CalendarRepository = require('../../modules/caldav/repositories/calendar-repository');
const CalendarController = require('../../modules/caldav/api/calendar-controller');

describe('CalDAV deleteByCalendarId method and transactional calendar deletion (plans/20)', () => {
    let testUser;
    let calendar;

    beforeAll(async () => {
        await sequelize.sync({ force: true });
    });

    beforeEach(async () => {
        testUser = await User.create({
            email: 'delete-calendar-plan20@test.com',
            password_digest: await bcrypt.hash('password', 10),
            verified: true,
        });
        calendar = await CalDAVCalendar.create({
            uid: 'delete-cal-plan20-uid',
            user_id: testUser.id,
            name: 'Plan 20 Calendar',
            enabled: true,
            sync_direction: 'bidirectional',
            sync_interval_minutes: 15,
            conflict_resolution: 'last_write_wins',
        });
        jest.clearAllMocks();
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

    describe('SyncStateRepository.deleteByCalendarId', () => {
        it('deletes all sync states for a given calendarId without throwing TypeError', async () => {
            const task1 = await Task.create({
                uid: 'task-cal-del-1',
                user_id: testUser.id,
                name: 'Test Task 1',
            });
            const task2 = await Task.create({
                uid: 'task-cal-del-2',
                user_id: testUser.id,
                name: 'Test Task 2',
            });

            await CalDAVSyncState.create({
                last_modified: new Date(),
                task_id: task1.id,
                calendar_id: calendar.id,
                etag: '"etag-cal-1"',
                last_synced_at: new Date(),
                sync_status: 'synced',
            });
            await CalDAVSyncState.create({
                last_modified: new Date(),
                task_id: task2.id,
                calendar_id: calendar.id,
                etag: '"etag-cal-2"',
                last_synced_at: new Date(),
                sync_status: 'synced',
            });

            expect(typeof SyncStateRepository.deleteByCalendarId).toBe(
                'function'
            );
            const deletedCount = await SyncStateRepository.deleteByCalendarId(
                calendar.id
            );
            expect(deletedCount).toBe(2);

            const remaining = await CalDAVSyncState.findAll({
                where: { calendar_id: calendar.id },
            });
            expect(remaining).toHaveLength(0);
        });
    });

    describe('CalendarController.deleteCalendar transactional handling', () => {
        it('deletes calendar and associated sync states without throwing TypeError', async () => {
            const task = await Task.create({
                uid: 'task-ctrl-del',
                user_id: testUser.id,
                name: 'Test Controller Task',
            });
            await CalDAVSyncState.create({
                last_modified: new Date(),
                task_id: task.id,
                calendar_id: calendar.id,
                etag: '"etag-ctrl"',
                last_synced_at: new Date(),
                sync_status: 'synced',
            });

            const req = {
                params: { id: calendar.id },
                currentUser: testUser,
            };
            const res = {
                status: jest.fn().mockReturnThis(),
                send: jest.fn(),
            };
            const next = jest.fn();

            await CalendarController.deleteCalendar(req, res, next);

            expect(next).not.toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(204);
            expect(res.send).toHaveBeenCalled();

            const foundCalendar = await CalendarRepository.findById(
                calendar.id
            );
            expect(foundCalendar).toBeNull();

            const foundSyncStates = await CalDAVSyncState.findAll({
                where: { calendar_id: calendar.id },
            });
            expect(foundSyncStates).toHaveLength(0);
        });

        it('rolls back sync states deletion if CalendarRepository.destroy fails during transaction', async () => {
            const task = await Task.create({
                uid: 'task-rollback-ctrl',
                user_id: testUser.id,
                name: 'Test Rollback Task',
            });
            await CalDAVSyncState.create({
                last_modified: new Date(),
                task_id: task.id,
                calendar_id: calendar.id,
                etag: '"etag-rollback-ctrl"',
                last_synced_at: new Date(),
                sync_status: 'synced',
            });

            jest.spyOn(CalendarRepository, 'destroy').mockRejectedValue(
                new Error('injected CalendarRepository.destroy failure')
            );

            const req = {
                params: { id: calendar.id },
                currentUser: testUser,
            };
            const res = {
                status: jest.fn().mockReturnThis(),
                send: jest.fn(),
            };
            const next = jest.fn();

            await CalendarController.deleteCalendar(req, res, next);

            expect(next).toHaveBeenCalledWith(
                expect.objectContaining({
                    message: 'injected CalendarRepository.destroy failure',
                })
            );

            const foundCalendar = await CalendarRepository.findById(
                calendar.id
            );
            expect(foundCalendar).not.toBeNull();

            const foundSyncStates = await CalDAVSyncState.findAll({
                where: { calendar_id: calendar.id },
            });
            expect(foundSyncStates).toHaveLength(1);
        });
    });
});
