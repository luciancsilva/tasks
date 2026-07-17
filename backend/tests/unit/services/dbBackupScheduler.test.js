'use strict';

const mockSchedule = jest.fn();
const mockStop = jest.fn();

jest.mock('node-cron', () => ({
    schedule: (...args) => {
        mockSchedule(...args);
        return { stop: mockStop };
    },
}));

jest.mock('../../../services/dbBackupService', () => ({
    createSnapshot: jest.fn(),
}));

describe('dbBackupScheduler', () => {
    let dbBackupScheduler;
    let createSnapshot;

    beforeEach(() => {
        jest.resetModules();
        mockSchedule.mockClear();
        mockStop.mockClear();
        delete process.env.TUDUDI_DB_BACKUP_ENABLED;
        delete process.env.TUDUDI_DB_BACKUP_CRON;
        createSnapshot =
            require('../../../services/dbBackupService').createSnapshot;
        dbBackupScheduler = require('../../../services/dbBackupScheduler');
    });

    it('does not schedule when TUDUDI_DB_BACKUP_ENABLED is unset', () => {
        dbBackupScheduler.initialize();

        expect(mockSchedule).not.toHaveBeenCalled();
        expect(dbBackupScheduler.isInitialized).toBe(false);
    });

    it('does not schedule when TUDUDI_DB_BACKUP_ENABLED is false', () => {
        process.env.TUDUDI_DB_BACKUP_ENABLED = 'false';

        dbBackupScheduler.initialize();

        expect(mockSchedule).not.toHaveBeenCalled();
    });

    it('schedules using the configured cron expression when enabled', () => {
        process.env.TUDUDI_DB_BACKUP_ENABLED = 'true';
        process.env.TUDUDI_DB_BACKUP_CRON = '*/5 * * * *';

        dbBackupScheduler.initialize();

        expect(mockSchedule).toHaveBeenCalledTimes(1);
        expect(mockSchedule.mock.calls[0][0]).toBe('*/5 * * * *');
        expect(dbBackupScheduler.isInitialized).toBe(true);
    });

    it('defaults to the daily 03:00 cron expression when unset', () => {
        process.env.TUDUDI_DB_BACKUP_ENABLED = 'true';

        dbBackupScheduler.initialize();

        expect(mockSchedule.mock.calls[0][0]).toBe('0 3 * * *');
    });

    it('does not schedule twice on repeated initialize()', () => {
        process.env.TUDUDI_DB_BACKUP_ENABLED = 'true';

        dbBackupScheduler.initialize();
        dbBackupScheduler.initialize();

        expect(mockSchedule).toHaveBeenCalledTimes(1);
    });

    it('logs and does not throw when the job callback errors', async () => {
        process.env.TUDUDI_DB_BACKUP_ENABLED = 'true';
        createSnapshot.mockRejectedValue(new Error('upload failed'));

        dbBackupScheduler.initialize();
        const jobCallback = mockSchedule.mock.calls[0][1];

        await expect(jobCallback()).resolves.toBeUndefined();
        expect(createSnapshot).toHaveBeenCalledTimes(1);
    });
});
