const request = require('supertest');
const app = require('../../app');
const path = require('path');
const fs = require('fs').promises;
const { Readable } = require('stream');
const { mockClient } = require('aws-sdk-client-mock');
const {
    PutObjectCommand,
    GetObjectCommand,
    DeleteObjectCommand,
} = require('@aws-sdk/client-s3');
const { Role, Setting } = require('../../models');
const r2Service = require('../../services/r2Service');
const { createTestUser } = require('../helpers/testUtils');

const s3Mock = mockClient(r2Service.getClient());

const makeBodyStream = (content) => Readable.from([Buffer.from(content)]);

async function loginAgent(email, password = 'password123') {
    const agent = request.agent(app);
    await agent.post('/api/login').send({ email, password });
    return agent;
}

describe('Branding API', () => {
    let adminUser, adminAgent, regularAgent;
    const testFilesDir = path.join(__dirname, '../branding-test-files');

    beforeAll(async () => {
        await fs.mkdir(testFilesDir, { recursive: true });
        await fs.writeFile(path.join(testFilesDir, 'logo.png'), 'PNG bytes');
        await fs.writeFile(
            path.join(testFilesDir, 'favicon.ico'),
            'ICO bytes'
        );
        await fs.writeFile(path.join(testFilesDir, 'evil.exe'), 'MZ');
    });

    afterAll(async () => {
        await fs.rm(testFilesDir, { recursive: true, force: true });
    });

    beforeEach(async () => {
        s3Mock.reset();
        s3Mock.on(PutObjectCommand).resolves({ ETag: '"test-etag"' });
        s3Mock.on(DeleteObjectCommand).resolves({});
        s3Mock.on(GetObjectCommand).resolves({
            Body: makeBodyStream('image bytes'),
            ContentType: 'image/png',
            ContentLength: 11,
        });

        await Setting.destroy({
            where: {
                key: [
                    'branding_app_name',
                    'branding_logo_light',
                    'branding_logo_dark',
                    'branding_favicon',
                ],
            },
        });

        adminUser = await createTestUser({ email: 'brand-admin@example.com' });
        await createTestUser({ email: 'brand-user@example.com' });

        await Role.destroy({ where: {} });
        await Role.findOrCreate({
            where: { user_id: adminUser.id },
            defaults: { user_id: adminUser.id, is_admin: true },
        });

        adminAgent = await loginAgent('brand-admin@example.com');
        regularAgent = await loginAgent('brand-user@example.com');
    });

    describe('GET /api/branding', () => {
        it('is public and returns null fields when nothing is customized', async () => {
            const response = await request(app).get('/api/branding');

            expect(response.status).toBe(200);
            expect(response.body).toEqual({
                app_name: null,
                logo_light: null,
                logo_dark: null,
                favicon: null,
            });
        });
    });

    describe('PUT /api/branding (app name)', () => {
        it('lets an admin set and clear the app name', async () => {
            let response = await adminAgent
                .put('/api/branding')
                .send({ app_name: 'My Tasks' });
            expect(response.status).toBe(200);
            expect(response.body.app_name).toBe('My Tasks');

            response = await request(app).get('/api/branding');
            expect(response.body.app_name).toBe('My Tasks');

            response = await adminAgent
                .put('/api/branding')
                .send({ app_name: '' });
            expect(response.status).toBe(200);
            expect(response.body.app_name).toBeNull();
        });

        it('rejects non-admin users', async () => {
            const response = await regularAgent
                .put('/api/branding')
                .send({ app_name: 'Nope' });
            expect(response.status).toBe(403);
        });

        it('requires authentication', async () => {
            const response = await request(app)
                .put('/api/branding')
                .send({ app_name: 'Nope' });
            expect(response.status).toBe(401);
        });

        it('rejects names longer than 100 characters', async () => {
            const response = await adminAgent
                .put('/api/branding')
                .send({ app_name: 'x'.repeat(101) });
            expect(response.status).toBe(400);
        });
    });

    describe('POST /api/branding/asset/:kind', () => {
        it('uploads a logo as admin and exposes its URL', async () => {
            const response = await adminAgent
                .post('/api/branding/asset/logo_light')
                .attach('file', path.join(testFilesDir, 'logo.png'));

            expect(response.status).toBe(201);
            expect(response.body.logo_light).toMatch(
                /^\/api\/branding\/asset\/logo_light-.+\.png$/
            );
        });

        it('deletes the previous object when replacing an asset', async () => {
            await adminAgent
                .post('/api/branding/asset/favicon')
                .attach('file', path.join(testFilesDir, 'favicon.ico'));

            const first = (await request(app).get('/api/branding')).body
                .favicon;

            await adminAgent
                .post('/api/branding/asset/favicon')
                .attach('file', path.join(testFilesDir, 'favicon.ico'));

            const oldKey = `branding/${first.split('/').pop()}`;
            const deletedKeys = s3Mock
                .commandCalls(DeleteObjectCommand)
                .map((call) => call.args[0].input.Key);
            expect(deletedKeys).toContain(oldKey);
        });

        it('rejects invalid asset kinds', async () => {
            const response = await adminAgent
                .post('/api/branding/asset/wallpaper')
                .attach('file', path.join(testFilesDir, 'logo.png'));
            expect(response.status).toBe(400);
        });

        it('rejects non-image files', async () => {
            const response = await adminAgent
                .post('/api/branding/asset/logo_light')
                .attach('file', path.join(testFilesDir, 'evil.exe'));
            expect(response.status).not.toBe(201);
        });

        it('rejects non-admin users and cleans up the uploaded object', async () => {
            const response = await regularAgent
                .post('/api/branding/asset/logo_light')
                .attach('file', path.join(testFilesDir, 'logo.png'));

            expect(response.status).toBe(403);
            // The object streamed by multer-s3 must be deleted again.
            expect(
                s3Mock.commandCalls(DeleteObjectCommand).length
            ).toBeGreaterThanOrEqual(1);
        });
    });

    describe('DELETE /api/branding/asset/:kind', () => {
        it('clears the asset and deletes the R2 object', async () => {
            await adminAgent
                .post('/api/branding/asset/logo_dark')
                .attach('file', path.join(testFilesDir, 'logo.png'));

            const url = (await request(app).get('/api/branding')).body
                .logo_dark;
            const objectKey = `branding/${url.split('/').pop()}`;

            const response = await adminAgent.delete(
                '/api/branding/asset/logo_dark'
            );

            expect(response.status).toBe(200);
            expect(response.body.logo_dark).toBeNull();

            const deletedKeys = s3Mock
                .commandCalls(DeleteObjectCommand)
                .map((call) => call.args[0].input.Key);
            expect(deletedKeys).toContain(objectKey);
        });

        it('rejects non-admin users', async () => {
            const response = await regularAgent.delete(
                '/api/branding/asset/logo_dark'
            );
            expect(response.status).toBe(403);
        });
    });

    describe('GET /api/branding/asset/:filename', () => {
        it('streams an asset without authentication', async () => {
            const response = await request(app).get(
                '/api/branding/asset/logo_light-1.png'
            );

            expect(response.status).toBe(200);
            expect(response.headers['content-type']).toContain('image/png');
            expect(response.headers['cache-control']).toContain('public');
        });

        it('rejects path traversal attempts', async () => {
            const response = await request(app).get(
                '/api/branding/asset/..%2Fsecrets.txt'
            );
            expect([400, 404]).toContain(response.status);
        });
    });
});
