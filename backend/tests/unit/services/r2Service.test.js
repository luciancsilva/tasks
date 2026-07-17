'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { mockClient } = require('aws-sdk-client-mock');
const {
    PutObjectCommand,
    ListObjectsV2Command,
} = require('@aws-sdk/client-s3');

// Load r2Service and mock its S3 client before any command is sent.
const r2Service = require('../../../services/r2Service');
const s3Mock = mockClient(r2Service.getClient());

// A real file used only by putObjectFromFile tests. Created once for the whole
// file so it is still present when listObjects tests run (Jest runs afterAll
// of a describe immediately after that block, before sibling blocks finish).
let tmpFile;

beforeAll(() => {
    tmpFile = path.join(os.tmpdir(), 'r2-test-upload.txt');
    fs.writeFileSync(tmpFile, 'hello r2');
});

afterAll(() => {
    fs.rmSync(tmpFile, { force: true });
});

afterEach(() => {
    s3Mock.reset();
});

describe('r2Service.putObjectFromFile', () => {
    it('sends PutObjectCommand with correct Bucket, Key, and ContentLength', async () => {
        s3Mock.on(PutObjectCommand).resolves({ ETag: '"etag-test"' });
        const key = 'db-backups/test.sqlite3';
        await r2Service.putObjectFromFile(key, tmpFile);

        const calls = s3Mock.commandCalls(PutObjectCommand);
        expect(calls).toHaveLength(1);

        const input = calls[0].args[0].input;
        expect(input.Bucket).toBe('tududi-test');
        expect(input.Key).toBe(key);
        expect(input.ContentLength).toBe(fs.statSync(tmpFile).size);
    });

    it('uses provided contentType', async () => {
        s3Mock.on(PutObjectCommand).resolves({});
        await r2Service.putObjectFromFile(
            'db-backups/test.sqlite3',
            tmpFile,
            'application/x-sqlite3'
        );

        const input = s3Mock.commandCalls(PutObjectCommand)[0].args[0].input;
        expect(input.ContentType).toBe('application/x-sqlite3');
    });

    it('defaults ContentType to application/octet-stream', async () => {
        s3Mock.on(PutObjectCommand).resolves({});
        await r2Service.putObjectFromFile('db-backups/test.sqlite3', tmpFile);

        const input = s3Mock.commandCalls(PutObjectCommand)[0].args[0].input;
        expect(input.ContentType).toBe('application/octet-stream');
    });

    it('propagates S3 errors', async () => {
        s3Mock.on(PutObjectCommand).rejects(new Error('S3 upload failed'));

        await expect(
            r2Service.putObjectFromFile('db-backups/test.sqlite3', tmpFile)
        ).rejects.toThrow('S3 upload failed');
    });
});

describe('r2Service.listObjects', () => {
    it('returns keys from a single page', async () => {
        s3Mock.on(ListObjectsV2Command).resolves({
            IsTruncated: false,
            Contents: [
                {
                    Key: 'db-backups/a.sqlite3',
                    LastModified: new Date('2026-01-01'),
                },
                {
                    Key: 'db-backups/b.sqlite3',
                    LastModified: new Date('2026-01-02'),
                },
            ],
        });

        const result = await r2Service.listObjects('db-backups/');

        expect(result).toHaveLength(2);
        expect(result[0].Key).toBe('db-backups/a.sqlite3');
        expect(result[1].Key).toBe('db-backups/b.sqlite3');
    });

    it('follows continuation token and merges results from multiple pages', async () => {
        // First page: truncated
        s3Mock
            .on(ListObjectsV2Command, { ContinuationToken: undefined })
            .resolves({
                IsTruncated: true,
                NextContinuationToken: 'token-page-2',
                Contents: [
                    {
                        Key: 'db-backups/page1.sqlite3',
                        LastModified: new Date('2026-01-01'),
                    },
                ],
            });

        // Second page: final
        s3Mock
            .on(ListObjectsV2Command, {
                ContinuationToken: 'token-page-2',
            })
            .resolves({
                IsTruncated: false,
                Contents: [
                    {
                        Key: 'db-backups/page2.sqlite3',
                        LastModified: new Date('2026-01-02'),
                    },
                ],
            });

        const result = await r2Service.listObjects('db-backups/');

        expect(result).toHaveLength(2);
        expect(result[0].Key).toBe('db-backups/page1.sqlite3');
        expect(result[1].Key).toBe('db-backups/page2.sqlite3');

        // Verify two SDK calls were made
        expect(s3Mock.commandCalls(ListObjectsV2Command)).toHaveLength(2);
    });

    it('returns empty array when bucket has no matching objects', async () => {
        s3Mock.on(ListObjectsV2Command).resolves({
            IsTruncated: false,
            Contents: undefined,
        });

        const result = await r2Service.listObjects('db-backups/');
        expect(result).toEqual([]);
    });

    it('passes the prefix to the SDK command', async () => {
        s3Mock.on(ListObjectsV2Command).resolves({
            IsTruncated: false,
            Contents: [],
        });

        await r2Service.listObjects('some-prefix/');

        const input =
            s3Mock.commandCalls(ListObjectsV2Command)[0].args[0].input;
        expect(input.Prefix).toBe('some-prefix/');
    });
});
