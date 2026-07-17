const request = require('supertest');
const app = require('../../app');
const { mockClient } = require('aws-sdk-client-mock');
const { DeleteObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3');
const { Project, Task, TaskAttachment } = require('../../models');
const r2Service = require('../../services/r2Service');
const { createTestUser } = require('../helpers/testUtils');

// Same pattern as project-image-cleanup.test.js / task-attachments.test.js:
// mock the shared R2 client instance so every command stays in-memory.
const s3Mock = mockClient(r2Service.getClient());

describe('Project deletion cascades R2 cleanup to deep subtasks', () => {
    let user, agent;

    beforeEach(async () => {
        s3Mock.reset();
        s3Mock.on(PutObjectCommand).resolves({ ETag: '"test-etag"' });
        s3Mock.on(DeleteObjectCommand).resolves({});

        user = await createTestUser({
            email: 'deep-subtask-cleanup@example.com',
        });

        agent = request.agent(app);
        await agent.post('/api/login').send({
            email: 'deep-subtask-cleanup@example.com',
            password: 'password123',
        });
    });

    const deletedKeys = () =>
        s3Mock
            .commandCalls(DeleteObjectCommand)
            .map((call) => call.args[0].input.Key);

    it('removes R2 attachments for a level-4 subtask when the project is deleted', async () => {
        const project = await Project.create({
            name: 'Deep tree project',
            user_id: user.id,
        });

        // Project -> Task A -> Subtask A.1 -> Subtask A.1.1 (level 4)
        const taskA = await Task.create({
            name: 'Task A',
            user_id: user.id,
            project_id: project.id,
        });
        const subtaskA1 = await Task.create({
            name: 'Subtask A.1',
            user_id: user.id,
            project_id: project.id,
            parent_task_id: taskA.id,
        });
        const subtaskA11 = await Task.create({
            name: 'Subtask A.1.1',
            user_id: user.id,
            project_id: project.id,
            parent_task_id: subtaskA1.id,
        });

        const deepAttachment = await TaskAttachment.create({
            task_id: subtaskA11.id,
            user_id: user.id,
            original_filename: 'deep-file.pdf',
            stored_filename: 'deep-file-stored.pdf',
            file_size: 123,
            mime_type: 'application/pdf',
            file_path: `tasks/${subtaskA11.uid}/deep-file-stored.pdf`,
        });

        const response = await agent.delete(`/api/project/${project.uid}`);

        expect(response.status).toBe(200);

        expect(deletedKeys()).toContain(deepAttachment.file_path);

        const remainingAttachment = await TaskAttachment.findByPk(
            deepAttachment.id
        );
        expect(remainingAttachment).toBeNull();

        const remainingTasks = await Task.findAll({
            where: { project_id: project.id },
        });
        expect(remainingTasks).toHaveLength(0);
    });
});
