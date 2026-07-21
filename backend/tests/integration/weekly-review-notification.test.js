const app = require('../../app');
const { User, Notification } = require('../../models');
const {
    processWeeklyReviewNotifications,
} = require('../../modules/tasks/taskScheduler');
const { createTestUser } = require('../helpers/testUtils');

const DAY = 24 * 60 * 60 * 1000;

const moment = require('moment-timezone');
const todayName = () =>
    moment.tz('UTC').locale('en').format('dddd').toLowerCase();
// The handler fires only when the user's local hour matches weekly_review_time,
// so fixtures have to name the hour the run actually happens in.
const currentHour = () => moment.tz('UTC').format('HH:00');
const otherHour = () => moment.tz('UTC').add(1, 'hour').format('HH:00');

describe('Weekly Review notification (55)', () => {
    let user;

    beforeEach(async () => {
        user = await createTestUser({
            email: 'weekly-notif@example.com',
        });
    });

    const setReviewState = async (overrides) => {
        await User.update(
            {
                weekly_review_enabled: true,
                weekly_review_day: todayName(),
                weekly_review_time: currentHour(),
                last_reviewed_at: new Date(Date.now() - 10 * DAY),
                ...overrides,
            },
            { where: { id: user.id } }
        );
    };

    const countNotifs = async () =>
        Notification.count({
            where: { user_id: user.id, type: 'weekly_review' },
        });

    it('creates notification type weekly_review (model accepts it)', async () => {
        await Notification.createNotification({
            userId: user.id,
            type: 'weekly_review',
            title: 'Weekly Review due',
            message: 'test',
            sources: [],
        });
        expect(await countNotifs()).toBe(1);
    });

    it('notifies user when review is due (last 10d ago, today)', async () => {
        await setReviewState();
        await processWeeklyReviewNotifications();
        expect(await countNotifs()).toBe(1);
    });

    it('skips user who reviewed recently (last 2d ago)', async () => {
        await setReviewState({
            last_reviewed_at: new Date(Date.now() - 2 * DAY),
        });
        await processWeeklyReviewNotifications();
        expect(await countNotifs()).toBe(0);
    });

    it('skips user with weekly_review_enabled=false', async () => {
        await setReviewState({ weekly_review_enabled: false });
        await processWeeklyReviewNotifications();
        expect(await countNotifs()).toBe(0);
    });

    it('skips user whose review day is not today', async () => {
        const otherDay = todayName() === 'friday' ? 'monday' : 'friday';
        await setReviewState({ weekly_review_day: otherDay });
        await processWeeklyReviewNotifications();
        expect(await countNotifs()).toBe(0);
    });

    it('skips user whose review hour is not the current one', async () => {
        await setReviewState({ weekly_review_time: otherHour() });
        await processWeeklyReviewNotifications();
        expect(await countNotifs()).toBe(0);
    });

    it('creates in-app only (no telegram) when user lacks creds', async () => {
        await setReviewState();
        await processWeeklyReviewNotifications();
        const notif = await Notification.findOne({
            where: { user_id: user.id, type: 'weekly_review' },
        });
        expect(notif).not.toBeNull();
        expect(notif.sources).toEqual([]);
    });
});
