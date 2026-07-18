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
        });

        if (dueTasks.length === 0) {
            return {
                success: true,
                tasksProcessed: 0,
                notificationsCreated: 0,
            };
        }

        let notificationsCreated = 0;

        for (const task of dueTasks) {
            try {
                const dueDate = new Date(task.due_date);
                const isOverdue = dueDate < now;
                const notificationType = isOverdue
                    ? 'task_overdue'
                    : 'task_due_soon';
                const level = isOverdue ? 'error' : 'warning';

                // Check if user wants this notification
                if (!shouldSendInAppNotification(task.User, notificationType)) {
                    continue;
                }

                // Check for existing notifications
                const recentNotifications = await Notification.findAll({
                    where: {
                        user_id: task.user_id,
                        type: {
                            [Op.in]: ['task_due_soon', 'task_overdue'],
                        },
                        created_at: {
                            [Op.gte]: twoDaysAgo,
                        },
                    },
                });

                const existingNotification = recentNotifications.find(
                    (notif) =>
                        notif.data?.taskUid === task.uid &&
                        notif.type === notificationType
                );

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
                const { title, message } = t(notificationType, lang, params);

                // Build sources array based on user preferences
                const sources = [];
                if (
                    shouldSendTelegramNotification(task.User, notificationType)
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

        return {
            success: true,
            tasksProcessed: dueTasks.length,
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
