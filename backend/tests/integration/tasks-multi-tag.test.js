const request = require('supertest');
const app = require('../../app');
const { Tag, Task, User } = require('../../models');
const { createTestUser } = require('../helpers/testUtils');

const DAY = 24 * 60 * 60 * 1000;

describe('Multi-tag filter AND/OR (57)', () => {
    let user, agent, workTag, phoneTag, computerTag;

    beforeEach(async () => {
        user = await createTestUser({ email: 'multitag@example.com' });
        agent = request.agent(app);
        await agent.post('/api/login').send({
            email: 'multitag@example.com',
            password: 'password123',
        });

        workTag = await Tag.create({ name: 'work', user_id: user.id });
        phoneTag = await Tag.create({ name: 'phone', user_id: user.id });
        computerTag = await Tag.create({
            name: 'computer',
            user_id: user.id,
        });
    });

    const createTaskWithTags = async (name, tagIds) => {
        const task = await Task.create({
            name,
            user_id: user.id,
            status: 0,
            due_date: new Date(Date.now() + 3 * DAY),
        });
        if (tagIds.length > 0) {
            await task.setTags(tagIds);
        }
        return task;
    };

    describe('GET /api/tasks?tags_any=', () => {
        it('returns tasks with ANY of the given tags (OR)', async () => {
            await createTaskWithTags('phone task', [phoneTag.id]);
            await createTaskWithTags('computer task', [computerTag.id]);
            await createTaskWithTags('untagged', []);

            const res = await agent.get('/api/tasks?tags_any=phone,computer');
            expect(res.status).toBe(200);
            const names = res.body.tasks.map((t) => t.name);
            expect(names).toContain('phone task');
            expect(names).toContain('computer task');
            expect(names).not.toContain('untagged');
        });

        it('returns empty for nonexistent tag', async () => {
            await createTaskWithTags('phone task', [phoneTag.id]);
            const res = await agent.get('/api/tasks?tags_any=nonexistent');
            expect(res.status).toBe(200);
            expect(res.body.tasks).toEqual([]);
        });

        it('combines tag (AND) with tags_any (OR)', async () => {
            await createTaskWithTags('work+phone', [workTag.id, phoneTag.id]);
            await createTaskWithTags('work+computer', [
                workTag.id,
                computerTag.id,
            ]);
            await createTaskWithTags('phone only', [phoneTag.id]);

            const res = await agent.get(
                '/api/tasks?tag=work&tags_any=phone,computer'
            );
            expect(res.status).toBe(200);
            const names = res.body.tasks.map((t) => t.name);
            expect(names).toContain('work+phone');
            expect(names).toContain('work+computer');
            expect(names).not.toContain('phone only');
        });
    });

    describe('GET /api/search?tags_any=', () => {
        it('returns tasks with ANY of the given tags via search', async () => {
            await createTaskWithTags('phone task', [phoneTag.id]);
            await createTaskWithTags('computer task', [computerTag.id]);
            await createTaskWithTags('untagged', []);

            const res = await agent.get(
                '/api/search?filters=Task&tags_any=phone,computer'
            );
            expect(res.status).toBe(200);
            const names = res.body.results.map((r) => r.name);
            expect(names).toContain('phone task');
            expect(names).toContain('computer task');
            expect(names).not.toContain('untagged');
        });

        it('combines tags (AND) + tags_any (OR) via search', async () => {
            await createTaskWithTags('work+phone', [workTag.id, phoneTag.id]);
            await createTaskWithTags('work+computer', [
                workTag.id,
                computerTag.id,
            ]);
            await createTaskWithTags('phone only', [phoneTag.id]);

            const res = await agent.get(
                '/api/search?filters=Task&tags=work&tags_any=phone,computer'
            );
            expect(res.status).toBe(200);
            const names = res.body.results.map((r) => r.name);
            expect(names).toContain('work+phone');
            expect(names).toContain('work+computer');
            expect(names).not.toContain('phone only');
        });
    });

    describe('View with tags_any', () => {
        it('persists tags_any', async () => {
            const createRes = await agent.post('/api/views').send({
                name: 'Calls or screen',
                tags_any: ['phone', 'computer'],
            });
            expect(createRes.status).toBe(201);
            const viewUid = createRes.body.uid;

            const res = await agent.get(`/api/views/${viewUid}`);
            expect(res.status).toBe(200);
            expect(res.body.tags_any).toEqual(
                expect.arrayContaining(['phone', 'computer'])
            );
        });

        it('combines tags (AND) + tags_any (OR) in a view', async () => {
            const createRes = await agent.post('/api/views').send({
                name: 'Work calls/screen',
                tags: ['work'],
                tags_any: ['phone', 'computer'],
            });
            expect(createRes.status).toBe(201);
            expect(createRes.body.tags).toEqual(['work']);
            expect(createRes.body.tags_any).toEqual(
                expect.arrayContaining(['phone', 'computer'])
            );
        });

        it('retrocompat: view without tags_any works', async () => {
            const createRes = await agent.post('/api/views').send({
                name: 'Work only',
                tags: ['work'],
            });
            expect(createRes.status).toBe(201);
            expect(createRes.body.tags).toEqual(['work']);
            expect(createRes.body.tags_any || []).toEqual([]);
        });
    });
});
