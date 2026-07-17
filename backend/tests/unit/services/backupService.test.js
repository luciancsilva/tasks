'use strict';

const fs = require('fs').promises;
const os = require('os');
const path = require('path');

describe('backupService.getBackupsDirectory', () => {
    let originalEnv;
    let tmpDir;

    beforeAll(async () => {
        originalEnv = { ...process.env };
        // Create a temp base dir for tests that rely on mkdir behaviour
        tmpDir = await fs.mkdtemp(
            path.join(os.tmpdir(), 'tududi-backup-test-')
        );
    });

    afterAll(async () => {
        process.env = originalEnv;
        await fs.rm(tmpDir, { recursive: true, force: true });
    });

    beforeEach(() => {
        jest.resetModules();
    });

    afterEach(() => {
        process.env = { ...originalEnv };
    });

    it('returns TUDUDI_BACKUP_PATH when env var is set', async () => {
        const customPath = path.join(tmpDir, 'custom-backups');
        process.env.TUDUDI_BACKUP_PATH = customPath;

        const {
            getBackupsDirectory,
        } = require('../../../services/backupService');
        const result = await getBackupsDirectory();

        expect(result).toBe(customPath);
    });

    it('creates the directory when it does not exist', async () => {
        const newDir = path.join(tmpDir, 'new-backups-dir');
        process.env.TUDUDI_BACKUP_PATH = newDir;

        // Ensure it does not exist before the call
        await fs.rm(newDir, { recursive: true, force: true });

        const {
            getBackupsDirectory,
        } = require('../../../services/backupService');
        await getBackupsDirectory();

        const stat = await fs.stat(newDir);
        expect(stat.isDirectory()).toBe(true);
    });

    it('default path is inside the db/ directory (persistent volume), not __dirname', async () => {
        delete process.env.TUDUDI_BACKUP_PATH;

        const {
            getBackupsDirectory,
        } = require('../../../services/backupService');
        const result = await getBackupsDirectory();

        // Default must include /db/backups and must NOT be relative to backend/services
        expect(result).toMatch(/db[/\\]backups$/);
        expect(result).not.toMatch(/backend[/\\]services/);
        expect(result).not.toMatch(/backend[/\\]backups$/);
    });
});
