'use strict';

const moment = require('moment-timezone');
const { User, Notification } = require('../../models');
const reviewsService = require('./service');
const {
    shouldSendTelegramNotification,
} = require('../../utils/notificationPreferences');

/**
 * Daily cron handler: notify users whose weekly review is due today
 * (matches weekly_review_day in their timezone) and not yet completed
 * within 7 days.
 */
async function processWeeklyReviewNotifications() {
    const users = await User.findAll({
        where: { weekly_review_enabled: true },
        attributes: [
            'id',
            'timezone',
            'weekly_review_day',
            'weekly_review_time',
            'telegram_bot_token',
            'telegram_chat_id',
            'notification_preferences',
        ],
    });

    for (const user of users) {
        const tz = user.timezone || 'UTC';
        const now = moment.tz(tz);
        const todayName = now.format('dddd').toLowerCase();
        if (user.weekly_review_day !== todayName) continue;

        const status = await reviewsService.getStatus(user.id);
        if (!status.suggested) continue;

        const sources = [];
        if (
            shouldSendTelegramNotification(user, 'weekly_review') &&
            user.telegram_bot_token &&
            user.telegram_chat_id
        ) {
            sources.push('telegram');
        }

        await Notification.createNotification({
            userId: user.id,
            type: 'weekly_review',
            level: 'info',
            title: 'Weekly Review due',
            message: `It's been ${
                status.days_since == null
                    ? 'a while'
                    : `${status.days_since} days`
            } since your last review.`,
            sources,
            data: {
                days_since: status.days_since,
                last_reviewed_at: status.last_reviewed_at,
            },
            sentAt: new Date(),
        });
    }
}

module.exports = { processWeeklyReviewNotifications };
