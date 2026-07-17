'use strict';

const fs = require('fs');
const { mockClient } = require('aws-sdk-client-mock');
const {
    PutObjectCommand,
    ListObjectsV2Command,
    DeleteObjectCommand,
} = require('@aws-sdk/client-s3');

const r2Service = require('../../../services/r2Service');
const s3Mock = mockClient(r2Service.getClient());

const dbBackupService = require('../../../services/dbBackupService');

const R2_ENV_KEYS = [
    'CLOUDFLARE_R2_ACCESS_KEY_ID',
    'CLOUDFLARE_R2_SECRET_ACCESS_KEY',
    'CLOUDFLARE_R2_BUCKET',
    'CLOUDFLARE_ACCOUNT_ID',
    'TUDUDI_DB_BACKUP_RETENTION',
];

describe('dbBackupService.createSnapshot', () => {
    beforeEach(() => {
        s3Mock.reset();
    });

    afterEach(() => {
        for (const key of R2_ENV_KEYS) {
            delete process.env[key];
        }
    });

    it('aborts without throwing when R2 is not configured', async () => {
        // No CLOUDFLARE_* credentials set (default test env): r2.enabled is false
        // regardless of the 'tududi-test' bucket fallback.
        const result = await dbBackupService.createSnapshot();

        expect(result).toBeNull();
        expect(s3Mock.commandCalls(PutObjectCommand)).toHaveLength(0);
    });

    describe('with R2 enabled', () => {
        beforeEach(() => {
            process.env.CLOUDFLARE_R2_ACCESS_KEY_ID = 'test-access-key';
            process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY = 'test-secret-key';
            process.env.CLOUDFLARE_R2_BUCKET = 'tududi-test';
            process.env.CLOUDFLARE_ACCOUNT_ID = 'test-account';
        });

        it('generates a snapshot and uploads it with the expected key format', async () => {
            s3Mock.on(PutObjectCommand).resolves({});
            s3Mock.on(ListObjectsV2Command).resolves({
                IsTruncated: false,
                Contents: [],
            });

            const result = await dbBackupService.createSnapshot();

            expect(result).not.toBeNull();
            expect(result.key).toMatch(
                /^db-backups\/test-\d{8}T\d{6}\.sqlite3$/
            );

            const putCalls = s3Mock.commandCalls(PutObjectCommand);
            expect(putCalls).toHaveLength(1);
            expect(putCalls[0].args[0].input.Key).toBe(result.key);
        });

        it('removes the temporary snapshot file even when the upload fails', async () => {
            s3Mock.on(PutObjectCommand).rejects(new Error('upload failed'));

            let capturedTmpPath;
            const originalRm = fs.promises.rm;
            jest.spyOn(fs.promises, 'rm').mockImplementation((p, opts) => {
                capturedTmpPath = p;
                return originalRm(p, opts);
            });

            await expect(dbBackupService.createSnapshot()).rejects.toThrow(
                'upload failed'
            );

            expect(capturedTmpPath).toBeDefined();
            expect(fs.existsSync(capturedTmpPath)).toBe(false);
        });

        it('prunes only the excess snapshots, keeping the N most recent', async () => {
            process.env.TUDUDI_DB_BACKUP_RETENTION = '2';
            s3Mock.on(PutObjectCommand).resolves({});
            s3Mock.on(ListObjectsV2Command).resolves({
                IsTruncated: false,
                Contents: [
                    { Key: 'db-backups/test-20260101T000000.sqlite3' },
                    { Key: 'db-backups/test-20260102T000000.sqlite3' },
                    { Key: 'db-backups/test-20260103T000000.sqlite3' },
                ],
            });
            s3Mock.on(DeleteObjectCommand).resolves({});

            const result = await dbBackupService.createSnapshot();

            expect(result.pruned).toBe(1);
            const deleteCalls = s3Mock.commandCalls(DeleteObjectCommand);
            expect(deleteCalls).toHaveLength(1);
            expect(deleteCalls[0].args[0].input.Key).toBe(
                'db-backups/test-20260101T000000.sqlite3'
            );
        });

        it('prunes nothing when there are fewer snapshots than the retention', async () => {
            process.env.TUDUDI_DB_BACKUP_RETENTION = '7';
            s3Mock.on(PutObjectCommand).resolves({});
            s3Mock.on(ListObjectsV2Command).resolves({
                IsTruncated: false,
                Contents: [{ Key: 'db-backups/test-20260101T000000.sqlite3' }],
            });

            const result = await dbBackupService.createSnapshot();

            expect(result.pruned).toBe(0);
            expect(s3Mock.commandCalls(DeleteObjectCommand)).toHaveLength(0);
        });

        it('prunes only current environment snapshots when mixed in the bucket', async () => {
            process.env.TUDUDI_DB_BACKUP_RETENTION = '1';
            s3Mock.on(PutObjectCommand).resolves({});
            s3Mock.on(ListObjectsV2Command).callsFake((input) => {
                if (input.Prefix === 'db-backups/test-') {
                    return {
                        IsTruncated: false,
                        Contents: [
                            { Key: 'db-backups/test-20260101T000000.sqlite3' },
                            { Key: 'db-backups/test-20260102T000000.sqlite3' },
                        ],
                    };
                }
                return {
                    IsTruncated: false,
                    Contents: [
                        {
                            Key: 'db-backups/development-20260101T000000.sqlite3',
                        },
                        { Key: 'db-backups/test-20260101T000000.sqlite3' },
                        { Key: 'db-backups/test-20260102T000000.sqlite3' },
                    ],
                };
            });
            s3Mock.on(DeleteObjectCommand).resolves({});

            const result = await dbBackupService.createSnapshot();

            expect(result.pruned).toBe(1);
            const listCalls = s3Mock.commandCalls(ListObjectsV2Command);
            expect(listCalls).toHaveLength(1);
            expect(listCalls[0].args[0].input.Prefix).toBe('db-backups/test-');

            const deleteCalls = s3Mock.commandCalls(DeleteObjectCommand);
            expect(deleteCalls).toHaveLength(1);
            expect(deleteCalls[0].args[0].input.Key).toBe(
                'db-backups/test-20260101T000000.sqlite3'
            );
        });
    });
});
