const { Task, Notification, User } = require('../../models');
const { Op } = require('sequelize');
const { logError } = require('../../services/logService');
const {
    shouldSendInAppNotification,
    shouldSendTelegramNotification,
} = require('../../utils/notificationPreferences');
const { t } = require('../notifications/i18n');

/**
 * Service to check for due and overdue tasks
 * and create notifications for users
 */

/**
 * Check for tasks that are due soon or overdue
 * and create notifications for the task owners
 */
async function checkDueTasks() {
    try {
        const now = new Date();
        const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);

        const BATCH_SIZE = 100;
        let offset = 0;
        let hasMore = true;
        let tasksProcessed = 0;
        let notificationsCreated = 0;

        while (hasMore) {
            const dueTasks = await Task.findAll({
                where: {
                    due_date: {
                        [Op.not]: null,
                        [Op.lte]: tomorrow,
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

            if (dueTasks.length === 0) {
                break;
            }

            const userIds = [...new Set(dueTasks.map((t) => t.user_id))];

            // Fetch recent notifications for these users once per batch
            const recentNotifications = await Notification.findAll({
                where: {
                    user_id: {
                        [Op.in]: userIds,
                    },
                    type: {
                        [Op.in]: ['task_due_soon', 'task_overdue'],
                    },
                    created_at: {
                        [Op.gte]: twoDaysAgo,
                    },
                },
            });

            // Index notifications by taskUid and type
            const notificationsByTask = {};
            for (const notif of recentNotifications) {
                if (notif.data?.taskUid) {
                    const key = `${notif.data.taskUid}:${notif.type}`;
                    notificationsByTask[key] = notif;
                }
            }

            for (const task of dueTasks) {
                try {
                    const dueDate = new Date(task.due_date);
                    const isOverdue = dueDate < now;
                    const notificationType = isOverdue
                        ? 'task_overdue'
                        : 'task_due_soon';
                    const level = isOverdue ? 'error' : 'warning';

                    // Check if user wants this notification
                    if (
                        !shouldSendInAppNotification(
                            task.User,
                            notificationType
                        )
                    ) {
                        continue;
                    }

                    // Check for existing notifications using the index
                    const existingNotification =
                        notificationsByTask[`${task.uid}:${notificationType}`];

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

                    const lang = task.User.language || 'en';
                    const params = { name: task.name };
                    if (isOverdue) {
                        params.daysOverdue = Math.floor(
                            (now - dueDate) / (1000 * 60 * 60 * 24)
                        );
                    } else {
                        params.hoursUntilDue = Math.floor(
                            (dueDate - now) / (1000 * 60 * 60)
                        );
                    }
                    const { title, message } = t(
                        notificationType,
                        lang,
                        params
                    );

                    // Build sources array based on user preferences
                    const sources = [];
                    if (
                        shouldSendTelegramNotification(
                            task.User,
                            notificationType
                        )
                    ) {
                        sources.push('telegram');
                    }

                    await Notification.createNotification({
                        userId: task.user_id,
                        type: notificationType,
                        title,
                        message,
                        level,
                        sources,
                        data: {
                            taskUid: task.uid,
                            taskName: task.name,
                            dueDate: task.due_date,
                            isOverdue,
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

            tasksProcessed += dueTasks.length;
            offset += BATCH_SIZE;
            if (dueTasks.length < BATCH_SIZE) {
                hasMore = false;
            }
        }

        return {
            success: true,
            tasksProcessed,
            notificationsCreated,
        };
    } catch (error) {
        logError('Error checking due tasks:', error);
        throw error;
    }
}

module.exports = {
    checkDueTasks,
};
