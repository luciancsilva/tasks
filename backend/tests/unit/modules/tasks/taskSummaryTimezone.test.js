'use strict';

const {
    _createTodayDateRange,
} = require('../../../../modules/tasks/taskSummaryService');

describe('createTodayDateRange (plan 46)', () => {
    it('returns startOfDay and endOfDay in UTC when no timezone given', () => {
        const { today, tomorrow } = _createTodayDateRange('UTC');
        const now = new Date();
        // today should be start of today in UTC
        expect(today.getUTCHours()).toBe(0);
        expect(today.getUTCMinutes()).toBe(0);
        expect(today.getUTCSeconds()).toBe(0);
        // tomorrow (endOfDay) should be 23:59 in UTC on the same day
        expect(tomorrow.getUTCHours()).toBe(23);
        expect(tomorrow.getUTCMinutes()).toBe(59);
    });

    it('today <= now <= endOfDay for given timezone', () => {
        const tz = 'America/Sao_Paulo'; // UTC-3
        const { today, tomorrow } = _createTodayDateRange(tz);
        const now = new Date();
        expect(today.getTime()).toBeLessThanOrEqual(now.getTime());
        expect(tomorrow.getTime()).toBeGreaterThanOrEqual(now.getTime());
    });

    it('returns correct day boundaries for America/Sao_Paulo (UTC-3)', () => {
        const { today, tomorrow } = _createTodayDateRange('America/Sao_Paulo');
        // endOfDay (tomorrow) must be after startOfDay (today)
        expect(tomorrow.getTime()).toBeGreaterThan(today.getTime());
        // difference should be roughly 1 day (~86400 seconds)
        const diffMs = tomorrow.getTime() - today.getTime();
        expect(diffMs).toBeGreaterThanOrEqual(23 * 3600 * 1000);
        expect(diffMs).toBeLessThanOrEqual(25 * 3600 * 1000);
    });
});
