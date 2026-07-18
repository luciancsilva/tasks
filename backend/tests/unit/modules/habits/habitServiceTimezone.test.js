const habitService = require('../../../../modules/habits/habitService');

describe('habitService timezone handling for streaks', () => {
    let originalTz;

    beforeAll(() => {
        originalTz = process.env.TZ;
        process.env.TZ = 'America/Sao_Paulo'; // Set process timezone to something different from UTC
    });

    afterAll(() => {
        if (originalTz) {
            process.env.TZ = originalTz;
        } else {
            delete process.env.TZ;
        }
    });

    it('should calculate streak = 2 for completions at 23:30 and 00:30 local time (across midnight)', () => {
        // User's timezone is America/Sao_Paulo
        const timezone = 'America/Sao_Paulo';

        // 2026-07-20 23:30 local (America/Sao_Paulo, offset -03:00) => 2026-07-21 02:30 UTC
        const completion1 = {
            completed_at: new Date('2026-07-21T02:30:00Z'),
        };

        // 2026-07-21 00:30 local (America/Sao_Paulo, offset -03:00) => 2026-07-21 03:30 UTC
        const completion2 = {
            completed_at: new Date('2026-07-21T03:30:00Z'),
        };

        const completions = [completion2, completion1]; // Unordered to ensure robust handling

        // The current day in user local time: 2026-07-21 12:00 local => 2026-07-21 15:00 UTC
        const asOfDate = new Date('2026-07-21T15:00:00Z');

        const streak = habitService.calculateCalendarStreak(
            completions,
            asOfDate,
            timezone
        );

        expect(streak).toBe(2);
    });

    it('should calculate best streak correctly with same timezone logic', () => {
        const timezone = 'America/Sao_Paulo';

        // 2026-07-20 23:30 local -> 2026-07-20 local
        const completion1 = { completed_at: new Date('2026-07-21T02:30:00Z') };
        // 2026-07-21 00:30 local -> 2026-07-21 local
        const completion2 = { completed_at: new Date('2026-07-21T03:30:00Z') };
        // 2026-07-22 10:00 local -> 2026-07-22 local
        const completion3 = { completed_at: new Date('2026-07-22T13:00:00Z') };

        const completions = [completion1, completion2, completion3];

        const bestStreak = habitService.calculateBestStreak(
            completions,
            timezone
        );

        expect(bestStreak).toBe(3);
    });

    it('should treat two completions on the same local day as streak=1', () => {
        const timezone = 'America/Sao_Paulo';

        // 2026-07-21 00:30 local -> 2026-07-21 local
        const completion1 = { completed_at: new Date('2026-07-21T03:30:00Z') };
        // 2026-07-21 23:30 local -> 2026-07-21 local (next UTC day: 2026-07-22T02:30Z)
        const completion2 = { completed_at: new Date('2026-07-22T02:30:00Z') };

        const completions = [completion1, completion2];

        const asOfDate = new Date('2026-07-21T15:00:00Z');

        const currentStreak = habitService.calculateCalendarStreak(
            completions,
            asOfDate,
            timezone
        );
        const bestStreak = habitService.calculateBestStreak(
            completions,
            timezone
        );

        expect(currentStreak).toBe(1);
        expect(bestStreak).toBe(1);
    });
});
