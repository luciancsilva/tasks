'use strict';

const moment = require('moment-timezone');
const { User, Notification } = require('../../models');
const reviewsService = require('./service');
const {
    shouldSendTelegramNotification,
} = require('../../utils/notificationPreferences');

const DEFAULT_REVIEW_TIME = '16:00';

/**
 * Parse the stored `HH:mm` preference into an hour, falling back to the model
 * default. Minutes are ignored: the cron ticks hourly, so the reminder lands at
 * the top of the configured hour.
 */
function targetHour(value) {
    const [hours] = String(value || DEFAULT_REVIEW_TIME).split(':');
    const parsed = Number.parseInt(hours, 10);
    return Number.isInteger(parsed) && parsed >= 0 && parsed <= 23
        ? parsed
        : 16;
}

/**
 * Hourly cron handler: notify users whose weekly review is due (matches
 * weekly_review_day AND weekly_review_time in their own timezone) and was not
 * completed within the last 7 days.
 *
 * Runs hourly rather than once a day because the reminder has to land at the
 * user's configured local hour; a single daily tick can only ever fire at one
 * fixed UTC hour, which is the wrong local time for everyone else.
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
        // Pin the locale: weekly_review_day stores English day names, and a
        // global moment.locale() elsewhere would silently stop every match.
        const todayName = now.locale('en').format('dddd').toLowerCase();
        if (user.weekly_review_day !== todayName) continue;
        if (now.hour() !== targetHour(user.weekly_review_time)) continue;

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
