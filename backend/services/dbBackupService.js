'use strict';

/**
 * Disaster-recovery snapshot of the SQLite database, uploaded to Cloudflare R2.
 *
 * Not a replica and not point-in-time fine-grained recovery — just an
 * offsite artifact so a lost host/volume does not mean lost data (see
 * plans/10b-db-snapshot-service.md for the incident that motivated this and
 * the alternatives that were rejected).
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { sequelize } = require('../models');
const { getConfig } = require('../config/config');
const { putObjectFromFile, listObjects, deleteObject } = require('./r2Service');
const { logInfo, logError } = require('./logService');

function formatTimestamp(date) {
    const pad = (n) => String(n).padStart(2, '0');
    return (
        `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}` +
        `T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}`
    );
}

/**
 * Delete the oldest objects under db-backups/ beyond `retention`, relying on
 * the timestamped key format so lexicographic sort matches chronological order.
 *
 * @returns {Promise<number>} number of objects pruned
 */
async function pruneOldSnapshots(retention) {
    const objects = await listObjects('db-backups/');
    const keys = objects.map((obj) => obj.Key).sort();

    const excess = keys.length - retention;
    if (excess <= 0) {
        return 0;
    }

    const toDelete = keys.slice(0, excess);
    for (const key of toDelete) {
        await deleteObject(key);
    }
    return toDelete.length;
}

/**
 * Snapshot the SQLite database and upload it to R2.
 *
 * Uses `VACUUM INTO` rather than copying the file directly: with WAL mode
 * (backend/models/index.js) a raw file copy can capture a partial/inconsistent
 * state, while VACUUM INTO produces a consistent snapshot without pausing the
 * app. The destination path is generated here — never from user input — and
 * must not already exist, which VACUUM INTO requires.
 *
 * @returns {Promise<{ key: string, size: number, pruned: number } | null>}
 *   null when R2 is not configured — a disabled destination is not an error,
 *   and a scheduled job must not throw because of it.
 */
async function createSnapshot() {
    const config = getConfig();
    if (!config.r2.enabled) {
        logInfo('[dbBackupService] R2 is not configured, skipping snapshot');
        return null;
    }

    const timestamp = formatTimestamp(new Date());
    const tmpPath = path.join(
        os.tmpdir(),
        `tududi-snapshot-${timestamp}-${process.pid}.sqlite3`
    );

    try {
        await sequelize.query('VACUUM INTO :path', {
            replacements: { path: tmpPath },
        });

        const key = `db-backups/${config.environment}-${timestamp}.sqlite3`;
        await putObjectFromFile(key, tmpPath, 'application/x-sqlite3');

        const { size } = fs.statSync(tmpPath);
        const pruned = await pruneOldSnapshots(config.dbBackupRetention);

        logInfo(
            `[dbBackupService] Snapshot uploaded: ${key} (${size} bytes, pruned ${pruned})`
        );
        return { key, size, pruned };
    } catch (err) {
        logError('[dbBackupService] Failed to create snapshot:', err);
        throw err;
    } finally {
        try {
            await fs.promises.rm(tmpPath, { force: true });
        } catch (cleanupErr) {
            logError(
                '[dbBackupService] Failed to remove temp snapshot file:',
                cleanupErr
            );
        }
    }
}

module.exports = {
    createSnapshot,
};
