const app = require('../../app');
const { User, Notification } = require('../../models');
const {
    processWeeklyReviewNotifications,
} = require('../../modules/tasks/taskScheduler');
const { createTestUser } = require('../helpers/testUtils');

const DAY = 24 * 60 * 60 * 1000;

const todayName = () =>
    new Date().toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();

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
