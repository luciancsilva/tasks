const request = require('supertest');
const app = require('../../app');
const { createTestUser } = require('../helpers/testUtils');
const {
    parsePriority,
    cleanTextFromTagsAndProjects,
    processInboxItem,
} = require('../../modules/inbox/inboxProcessingService');

describe('Inbox !priority token (68)', () => {
    let agent;

    beforeEach(async () => {
        await createTestUser({ email: 'prio@example.com' });
        agent = request.agent(app);
        await agent.post('/api/login').send({
            email: 'prio@example.com',
            password: 'password123',
        });
    });

    it('parses !high with project and strips token from cleaned content', async () => {
        const res = await agent
            .post('/api/inbox/analyze-text')
            .send({ content: 'Ligar cliente !high +Vendas' });
        expect(res.status).toBe(200);
        expect(res.body.parsed_priority).toBe('high');
        expect(res.body.parsed_projects).toEqual(['Vendas']);
        expect(res.body.cleaned_content).toBe('Ligar cliente');
    });

    it('parses !low', async () => {
        const res = await agent
            .post('/api/inbox/analyze-text')
            .send({ content: 'Relatório !low' });
        expect(res.status).toBe(200);
        expect(res.body.parsed_priority).toBe('low');
    });

    it('returns null parsed_priority when no token present', async () => {
        const res = await agent
            .post('/api/inbox/analyze-text')
            .send({ content: 'Sem priority' });
        expect(res.status).toBe(200);
        expect(res.body.parsed_priority).toBeNull();
    });

    it('ignores invalid priority values', () => {
        expect(parsePriority('task !invalid')).toEqual([]);
        expect(processInboxItem('task !invalid').parsed_priority).toBeNull();
    });

    it('first wins on multiple priority tokens', () => {
        expect(parsePriority('!high !low')).toEqual(['high', 'low']);
        expect(processInboxItem('!high !low').parsed_priority).toBe('high');
    });

    it('is case-insensitive', () => {
        expect(parsePriority('!HIGH !Medium')).toEqual(['high', 'medium']);
    });

    it('strips !priority token from cleaned content', () => {
        expect(cleanTextFromTagsAndProjects('!high task')).toBe('task');
        expect(cleanTextFromTagsAndProjects('task !medium')).toBe('task');
        expect(cleanTextFromTagsAndProjects('!high #tag task')).toBe('task');
    });
});
