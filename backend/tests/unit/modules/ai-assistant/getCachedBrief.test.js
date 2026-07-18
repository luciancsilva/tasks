'use strict';

// Stub heavy transitive deps before requiring the module under test
jest.mock('../../../../models', () => ({
    User: { findByPk: jest.fn() },
    Goal: { findAll: jest.fn() },
    Project: { findAll: jest.fn() },
    Area: {},
    Task: {
        findAll: jest.fn(),
        STATUS: {
            NOT_STARTED: 0,
            IN_PROGRESS: 1,
            DONE: 2,
            ARCHIVED: 3,
            WAITING: 4,
            CANCELLED: 5,
            PLANNED: 6,
        },
    },
}));

jest.mock('openai', () => jest.fn().mockImplementation(() => ({})));

jest.mock(
    '../../../../modules/tasks/queries/metrics-computation',
    () => ({ computeTaskMetrics: jest.fn() })
);

const { User } = require('../../../../models');
const { getCachedBrief } = require('../../../../modules/ai-assistant/service');

describe('getCachedBrief', () => {
    const BRIEF = { focus: 'Write tests', priority_actions: [], watch_out: [] };

    beforeEach(() => jest.clearAllMocks());

    it('returns null when user not found', async () => {
        User.findByPk.mockResolvedValue(null);
        expect(await getCachedBrief(1)).toBeNull();
    });

    it('returns null when user has no brief', async () => {
        User.findByPk.mockResolvedValue({
            ai_daily_brief: null,
            ai_daily_brief_date: null,
            timezone: 'UTC',
        });
        expect(await getCachedBrief(1)).toBeNull();
    });

    it('returns null when ai_daily_brief_date is yesterday', async () => {
        const yesterday = new Date();
        yesterday.setUTCDate(yesterday.getUTCDate() - 1);
        const yesterdayStr = yesterday.toISOString().slice(0, 10);
        User.findByPk.mockResolvedValue({
            ai_daily_brief: BRIEF,
            ai_daily_brief_date: yesterdayStr,
            timezone: 'UTC',
        });
        expect(await getCachedBrief(1)).toBeNull();
    });

    it('returns brief when ai_daily_brief_date is today (UTC)', async () => {
        const todayStr = new Date().toISOString().slice(0, 10);
        User.findByPk.mockResolvedValue({
            ai_daily_brief: BRIEF,
            ai_daily_brief_date: todayStr,
            timezone: 'UTC',
        });
        expect(await getCachedBrief(1)).toEqual(BRIEF);
    });

    it('falls back to UTC when no timezone set', async () => {
        const todayStr = new Date().toISOString().slice(0, 10);
        User.findByPk.mockResolvedValue({
            ai_daily_brief: BRIEF,
            ai_daily_brief_date: todayStr,
            timezone: null,
        });
        expect(await getCachedBrief(1)).toEqual(BRIEF);
    });
});
