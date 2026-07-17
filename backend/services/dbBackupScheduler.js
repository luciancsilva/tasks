'use strict';

/**
 * Schedules dbBackupService.createSnapshot() via node-cron.
 *
 * Disabled by default (TUDUDI_DB_BACKUP_ENABLED) — backup is instance infra,
 * not a user preference (see plans/10c-backup-scheduler.md).
 */

const cron = require('node-cron');
const { logInfo, logError } = require('./logService');
const { createSnapshot } = require('./dbBackupService');

class DbBackupScheduler {
    constructor() {
        this.isInitialized = false;
        this.job = null;
    }

    initialize() {
        if (this.isInitialized) {
            logInfo('Database backup scheduler already initialized');
            return;
        }

        const enabled = process.env.TUDUDI_DB_BACKUP_ENABLED === 'true';
        if (!enabled) {
            logInfo(
                'Database backup scheduler disabled via TUDUDI_DB_BACKUP_ENABLED'
            );
            return;
        }

        const cronExpression = process.env.TUDUDI_DB_BACKUP_CRON || '0 3 * * *';

        this.job = cron.schedule(cronExpression, async () => {
            try {
                await createSnapshot();
            } catch (error) {
                logError(
                    `Database backup snapshot failed: ${error.message}`,
                    error
                );
            }
        });

        this.isInitialized = true;
        logInfo(
            `Database backup scheduler initialized with cron "${cronExpression}"`
        );
    }

    shutdown() {
        if (this.job) {
            this.job.stop();
            this.job = null;
        }
        this.isInitialized = false;
    }
}

module.exports = new DbBackupScheduler();
