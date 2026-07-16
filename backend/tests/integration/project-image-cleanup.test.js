const request = require('supertest');
const app = require('../../app');
const { mockClient } = require('aws-sdk-client-mock');
const { DeleteObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3');
const { Project } = require('../../models');
const r2Service = require('../../services/r2Service');
const { createTestUser } = require('../helpers/testUtils');

// Intercept all S3/R2 traffic through the shared client (same pattern as
// task-attachments.test.js) so no command ever reaches the network.
const s3Mock = mockClient(r2Service.getClient());

describe('Project cover image R2 cleanup', () => {
    let user, agent, project;

    beforeEach(async () => {
        s3Mock.reset();
        s3Mock.on(PutObjectCommand).resolves({ ETag: '"test-etag"' });
        s3Mock.on(DeleteObjectCommand).resolves({});

        user = await createTestUser({
            email: 'project-image-cleanup@example.com',
        });

        agent = request.agent(app);
        await agent.post('/api/login').send({
            email: 'project-image-cleanup@example.com',
            password: 'password123',
        });

        project = await Project.create({
            name: 'Project with cover',
            user_id: user.id,
            image_url: '/api/uploads/projects/project-old-cover.jpg',
        });
    });

    const deletedKeys = () =>
        s3Mock
            .commandCalls(DeleteObjectCommand)
            .map((call) => call.args[0].input.Key);

    describe('PATCH /api/project/:uid', () => {
        it('deletes the old R2 object when the cover image is removed', async () => {
            const response = await agent
                .patch(`/api/project/${project.uid}`)
                .send({ image_url: '' });

            expect(response.status).toBe(200);
            expect(deletedKeys()).toContain('projects/project-old-cover.jpg');

            const updated = await Project.findByPk(project.id);
            expect(updated.image_url).toBeNull();
        });

        it('deletes the old R2 object when the cover image is replaced', async () => {
            const response = await agent
                .patch(`/api/project/${project.uid}`)
                .send({
                    image_url: '/api/uploads/projects/project-new-cover.jpg',
                });

            expect(response.status).toBe(200);
            expect(deletedKeys()).toContain('projects/project-old-cover.jpg');
            expect(deletedKeys()).not.toContain(
                'projects/project-new-cover.jpg'
            );
        });

        it('does not touch R2 when image_url is not part of the update', async () => {
            const response = await agent
                .patch(`/api/project/${project.uid}`)
                .send({ name: 'Renamed project' });

            expect(response.status).toBe(200);
            expect(s3Mock.commandCalls(DeleteObjectCommand)).toHaveLength(0);
        });

        it('does not touch R2 when image_url is unchanged', async () => {
            const response = await agent
                .patch(`/api/project/${project.uid}`)
                .send({
                    image_url: '/api/uploads/projects/project-old-cover.jpg',
                });

            expect(response.status).toBe(200);
            expect(s3Mock.commandCalls(DeleteObjectCommand)).toHaveLength(0);
        });

        it('never issues a delete for external image URLs', async () => {
            await Project.update(
                { image_url: 'https://example.com/some.jpg' },
                { where: { id: project.id } }
            );

            const response = await agent
                .patch(`/api/project/${project.uid}`)
                .send({ image_url: '' });

            expect(response.status).toBe(200);
            expect(s3Mock.commandCalls(DeleteObjectCommand)).toHaveLength(0);
        });
    });

    describe('DELETE /api/project/:uid', () => {
        it('deletes the cover image object from R2 when the project is deleted', async () => {
            const response = await agent.delete(`/api/project/${project.uid}`);

            expect(response.status).toBe(200);
            expect(deletedKeys()).toContain('projects/project-old-cover.jpg');
        });

        it('still deletes the project when R2 is unavailable', async () => {
            s3Mock.on(DeleteObjectCommand).rejects(new Error('R2 down'));

            const response = await agent.delete(`/api/project/${project.uid}`);

            expect(response.status).toBe(200);
            const gone = await Project.findByPk(project.id);
            expect(gone).toBeNull();
        });

        it('does not delete the cover image from R2 if the transaction rolls back', async () => {
            const { Note } = require('../../models');
            const originalUpdate = Note.update;
            // Force Note.update to fail inside the transaction
            Note.update = jest
                .fn()
                .mockRejectedValue(new Error('Forced DB Error'));

            const response = await agent.delete(`/api/project/${project.uid}`);

            // Restore original Note.update
            Note.update = originalUpdate;

            expect(response.status).toBe(500);
            expect(s3Mock.commandCalls(DeleteObjectCommand)).toHaveLength(0);

            // Verify project still exists
            const stillExists = await Project.findByPk(project.id);
            expect(stillExists).not.toBeNull();
        });
    });
});
