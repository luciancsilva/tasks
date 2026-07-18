const { Task, Notification, User } = require('../../models');
const { Op } = require('sequelize');
const { logError } = require('../../services/logService');
const {
    shouldSendInAppNotification,
    shouldSendTelegramNotification,
} = require('../../utils/notificationPreferences');

async function checkDeferredTasks() {
    try {
        const now = new Date();
        const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);

        const BATCH_SIZE = 100;
        let offset = 0;
        let hasMore = true;
        let tasksProcessed = 0;
        let notificationsCreated = 0;
        const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

        while (hasMore) {
            const deferredTasks = await Task.findAll({
                where: {
                    defer_until: {
                        [Op.not]: null,
                        [Op.lte]: fiveMinutesFromNow,
                    },
                    status: {
                        [Op.ne]: 2,
                    },
                },
                include: [
                    {
                        model: User,
                        attributes: [
                            'id',
                            'email',
                            'name',
                            'language',
                            'notification_preferences',
                        ],
                    },
                ],
                limit: BATCH_SIZE,
                offset,
                order: [['id', 'ASC']],
            });

            if (deferredTasks.length === 0) {
                break;
            }

            const userIds = [...new Set(deferredTasks.map(t => t.user_id))];

            // Fetch recent notifications for these users once per batch
            const recentNotifications = await Notification.findAll({
                where: {
                    user_id: {
                        [Op.in]: userIds,
                    },
                    type: 'task_due_soon',
                    created_at: {
                        [Op.gte]: oneDayAgo,
                    },
                },
            });

            // Index notifications by taskUid and reason
            const notificationsByTask = {};
            for (const notif of recentNotifications) {
                if (notif.data?.taskUid && notif.data?.reason === 'defer_until_reached') {
                    const key = `${notif.data.taskUid}:${notif.data.reason}`;
                    notificationsByTask[key] = notif;
                }
            }

            for (const task of deferredTasks) {
                try {
                    if (!shouldSendInAppNotification(task.User, 'deferUntil')) {
                        continue;
                    }

                    // Check for existing notifications using the index
                    const existingNotification = notificationsByTask[`${task.uid}:defer_until_reached`];

                    // Preserve channel_sent_at for rate limiting when recreating notifications
                    let preservedChannelSentAt = null;

                    if (existingNotification) {
                        // If notification was dismissed, don't create it again
                        if (existingNotification.dismissed_at) {
                            continue;
                        }

                        // If notification is unread, delete it before creating the new one
                        // This prevents duplicate notifications from piling up
                        if (!existingNotification.read_at) {
                            // Preserve channel_sent_at to maintain rate limiting across recreations
                            preservedChannelSentAt =
                                existingNotification.channel_sent_at;
                            await existingNotification.destroy();
                        } else {
                            // If it was already read, skip creating a new one
                            continue;
                        }
                    }

                    const sources = [];
                    if (shouldSendTelegramNotification(task.User, 'deferUntil')) {
                        sources.push('telegram');
                    }

                    const lang = task.User.language || 'en';
                    const { title, message } = require('../notifications/i18n').t(
                        'task_now_active',
                        lang,
                        { name: task.name }
                    );

                    await Notification.createNotification({
                        userId: task.user_id,
                        type: 'task_due_soon',
                        title,
                        message,
                        sources,
                        data: {
                            taskUid: task.uid,
                            taskName: task.name,
                            deferUntil: task.defer_until,
                            reason: 'defer_until_reached',
                        },
                        sentAt: new Date(),
                        channel_sent_at: preservedChannelSentAt,
                    });

                    notificationsCreated++;
                } catch (error) {
                    logError(
                        `Error creating notification for task ${task.id}:`,
                        error
                    );
                }
            }

            tasksProcessed += deferredTasks.length;
            offset += BATCH_SIZE;
            if (deferredTasks.length < BATCH_SIZE) {
                hasMore = false;
            }
        }

        return {
            success: true,
            tasksProcessed,
            notificationsCreated,
        };
    } catch (error) {
        logError('Error checking deferred tasks:', error);
        throw error;
    }
}

async function getDeferredTaskStats() {
    try {
        const now = new Date();

        const [totalDeferred, activeNow, activeSoon] = await Promise.all([
            Task.count({
                where: {
                    defer_until: {
                        [Op.not]: null,
                    },
                    status: {
                        [Op.ne]: 2, // Not completed
                    },
                },
            }),

            Task.count({
                where: {
                    defer_until: {
                        [Op.not]: null,
                        [Op.lte]: now,
                    },
                    status: {
                        [Op.ne]: 2, // Not completed
                    },
                },
            }),

            Task.count({
                where: {
                    defer_until: {
                        [Op.not]: null,
                        [Op.gt]: now,
                        [Op.lte]: new Date(now.getTime() + 60 * 60 * 1000),
                    },
                    status: {
                        [Op.ne]: 2, // Not completed
                    },
                },
            }),
        ]);

        return {
            totalDeferred,
            activeNow,
            activeSoon,
        };
    } catch (error) {
        logError('Error getting deferred task stats:', error);
        throw error;
    }
}

module.exports = {
    checkDeferredTasks,
    getDeferredTaskStats,
};
