const { Task } = require('../../../models');
const taskRepository = require('../repository');
const {
    calculateNextDueDate,
    shouldGenerateNextTask,
} = require('../recurringTaskService');
const {
    processDueDateForResponse,
    getSafeTimezone,
    dateStringToUTC,
    getCurrentDateInTimezone,
} = require('../../../utils/timezone-utils');

const RECURRENCE_FIELDS = [
    'recurrence_type',
    'recurrence_interval',
    'recurrence_end_date',
    'recurrence_weekday',
    'recurrence_weekdays',
    'recurrence_month_day',
    'recurrence_week_of_month',
    'completion_based',
];

/**
 * Applies a recurring instance's recurrence edits to its parent template, so
 * editing one occurrence can retune the whole series. Fields absent from the
 * payload keep the parent's current value.
 */
async function propagateRecurrenceToParent(task, body, userId) {
    if (!task.recurring_parent_id) return;

    const parentTask = await taskRepository.findByIdAndUser(
        task.recurring_parent_id,
        userId
    );

    if (!parentTask) return;

    const updates = {};
    for (const field of RECURRENCE_FIELDS) {
        updates[field] =
            body[field] !== undefined ? body[field] : parentTask[field];
    }

    await parentTask.update(updates);
}

/**
 * Works out what completing a recurring parent implies: the completion record
 * to store, and - when the series has not ended - the next occurrence the task
 * should roll forward to.
 *
 * Returns null when the update is not the completion of a recurring parent.
 */
function planRecurrenceAdvance(
    task,
    taskAttributes,
    status,
    resolveFinalValue
) {
    const finalRecurrenceType = resolveFinalValue('recurrence_type');
    const finalCompletionBased = resolveFinalValue('completion_based');
    const finalDueDateBeforeAdvance =
        taskAttributes.due_date !== undefined
            ? taskAttributes.due_date
            : task.due_date;

    const isCompletingRecurringParent =
        status !== undefined &&
        (taskAttributes.status === Task.STATUS.DONE ||
            taskAttributes.status === 'done') &&
        finalRecurrenceType &&
        finalRecurrenceType !== 'none' &&
        !task.recurring_parent_id;

    if (!isCompletingRecurringParent) return null;

    const completedAt = new Date();
    const hasOriginalDueDate =
        finalDueDateBeforeAdvance !== undefined &&
        finalDueDateBeforeAdvance !== null &&
        finalDueDateBeforeAdvance !== '';
    const originalDueDate = hasOriginalDueDate
        ? new Date(finalDueDateBeforeAdvance)
        : new Date(completedAt);

    const recurrenceContext = {
        ...(typeof task.get === 'function' ? task.get({ plain: true }) : task),
        recurrence_type: finalRecurrenceType,
        recurrence_interval: resolveFinalValue('recurrence_interval'),
        recurrence_end_date: resolveFinalValue('recurrence_end_date'),
        recurrence_weekday: resolveFinalValue('recurrence_weekday'),
        recurrence_weekdays: resolveFinalValue('recurrence_weekdays'),
        recurrence_month_day: resolveFinalValue('recurrence_month_day'),
        recurrence_week_of_month: resolveFinalValue('recurrence_week_of_month'),
        completion_based: finalCompletionBased,
        due_date: originalDueDate,
    };

    const baseDate = finalCompletionBased
        ? completedAt
        : new Date(originalDueDate);
    const nextDueDate = calculateNextDueDate(recurrenceContext, baseDate);

    return {
        completionPayload: {
            task_id: task.id,
            completed_at: completedAt,
            original_due_date: new Date(originalDueDate),
            skipped: false,
        },
        advanceInfo: {
            originalDueDate: new Date(originalDueDate),
            completedAt,
            nextDueDate,
        },
        completionBased: finalCompletionBased,
        // Only roll forward while the series is still running.
        shouldAdvance: Boolean(
            nextDueDate &&
                shouldGenerateNextTask(recurrenceContext, nextDueDate)
        ),
    };
}

async function handleRecurrenceUpdate(task, recurrenceFields, reqBody) {
    // Check if recurrence fields changed
    const recurrenceChanged = recurrenceFields.some((field) => {
        const newValue = reqBody[field];
        return newValue !== undefined && newValue !== task[field];
    });

    // Also check if template fields that affect instances have changed
    // These fields should be propagated to all future instances
    const templateFieldsChanged = [
        'name',
        'project_id',
        'priority',
        'note',
    ].some((field) => {
        const newValue = reqBody[field];
        return newValue !== undefined && newValue !== task[field];
    });

    const shouldRegenerateInstances =
        (recurrenceChanged || templateFieldsChanged) &&
        task.recurrence_type !== 'none';

    if (!shouldRegenerateInstances) {
        return false;
    }

    const childTasks = await taskRepository.findRecurringChildren(task.id);

    if (childTasks.length > 0) {
        const now = new Date();
        const futureInstances = childTasks.filter((child) => {
            if (!child.due_date) return true;
            return new Date(child.due_date) > now;
        });

        const newRecurrenceType =
            reqBody.recurrence_type !== undefined
                ? reqBody.recurrence_type
                : task.recurrence_type;

        if (newRecurrenceType !== 'none') {
            for (const futureInstance of futureInstances) {
                try {
                    await futureInstance.destroy();
                } catch (error) {
                    // If dependent records block deletion (e.g., subtasks FK), skip that instance
                    console.warn(
                        'Skipping recurring instance deletion due to constraint:',
                        {
                            id: futureInstance.id,
                            error: error?.message,
                        }
                    );
                }
            }
        }
    }

    return shouldRegenerateInstances;
}

async function calculateNextIterations(task, startFromDate, userTimezone) {
    const iterations = [];
    const safeTimezone = getSafeTimezone(userTimezone);

    // Parse start date properly in user's timezone
    let startDate;
    if (startFromDate) {
        // Convert the date string from user timezone to UTC
        startDate = dateStringToUTC(startFromDate, safeTimezone, 'start');
    } else {
        // Get today's date in user's timezone and convert to UTC
        const todayInUserTz = getCurrentDateInTimezone(safeTimezone);
        startDate = dateStringToUTC(todayInUserTz, safeTimezone, 'start');
    }

    let nextDate = new Date(startDate);
    let includesToday = false;

    // Check if today matches the recurrence pattern
    if (task.recurrence_type === 'weekly') {
        // Check if today matches any of the weekdays
        if (task.recurrence_weekdays) {
            // Note: Sequelize getter already parses JSON, so it's already an array
            const weekdays = Array.isArray(task.recurrence_weekdays)
                ? task.recurrence_weekdays
                : JSON.parse(task.recurrence_weekdays);
            const todayWeekday = nextDate.getUTCDay();
            console.log('Weekly recurrence check:', {
                weekdays,
                todayWeekday,
                includes: weekdays.includes(todayWeekday),
            });
            includesToday = weekdays.includes(todayWeekday);
        } else if (
            task.recurrence_weekday !== null &&
            task.recurrence_weekday !== undefined
        ) {
            const todayWeekday = nextDate.getUTCDay();
            includesToday = task.recurrence_weekday === todayWeekday;
        }
    } else if (task.recurrence_type === 'daily') {
        includesToday = true;
    } else if (task.recurrence_type === 'monthly') {
        const targetDay =
            task.recurrence_month_day !== null &&
            task.recurrence_month_day !== undefined
                ? task.recurrence_month_day
                : startDate.getUTCDate();
        const todayDay = startDate.getUTCDate();

        if (targetDay > todayDay) {
            const currentMonth = startDate.getUTCMonth();
            const currentYear = startDate.getUTCFullYear();
            const maxDayInMonth = new Date(
                Date.UTC(currentYear, currentMonth + 1, 0)
            ).getUTCDate();

            if (targetDay <= maxDayInMonth) {
                includesToday = true;
                nextDate = new Date(
                    Date.UTC(
                        currentYear,
                        currentMonth,
                        targetDay,
                        startDate.getUTCHours(),
                        startDate.getUTCMinutes(),
                        startDate.getUTCSeconds(),
                        startDate.getUTCMilliseconds()
                    )
                );
            }
        }
    }

    console.log('calculateNextIterations:', {
        startDate: startDate.toISOString(),
        includesToday,
        recurrence_type: task.recurrence_type,
        recurrence_weekdays: task.recurrence_weekdays,
    });

    // If today doesn't match, calculate the next occurrence
    if (!includesToday) {
        if (task.recurrence_type === 'daily') {
            nextDate.setUTCDate(
                nextDate.getUTCDate() + (task.recurrence_interval || 1)
            );
        } else if (task.recurrence_type === 'weekly') {
            const interval = task.recurrence_interval || 1;
            if (task.recurrence_weekdays) {
                const weekdays = Array.isArray(task.recurrence_weekdays)
                    ? task.recurrence_weekdays
                    : JSON.parse(task.recurrence_weekdays);
                const sorted = [...weekdays].sort((a, b) => a - b);
                const currentDay = nextDate.getUTCDay();
                const laterInWeek = sorted.filter((d) => d > currentDay);
                if (laterInWeek.length > 0) {
                    nextDate.setUTCDate(
                        nextDate.getUTCDate() + (laterInWeek[0] - currentDay)
                    );
                } else {
                    const daysToNextFirst =
                        (7 - currentDay + sorted[0]) % 7 || 7;
                    nextDate.setUTCDate(
                        nextDate.getUTCDate() +
                            daysToNextFirst +
                            (interval - 1) * 7
                    );
                }
            } else if (
                task.recurrence_weekday !== null &&
                task.recurrence_weekday !== undefined
            ) {
                const currentWeekday = nextDate.getUTCDay();
                const daysUntilTarget =
                    (task.recurrence_weekday - currentWeekday + 7) % 7;
                if (daysUntilTarget === 0) {
                    nextDate.setUTCDate(nextDate.getUTCDate() + interval * 7);
                } else {
                    nextDate.setUTCDate(
                        nextDate.getUTCDate() + daysUntilTarget
                    );
                }
            } else {
                nextDate.setUTCDate(nextDate.getUTCDate() + interval * 7);
            }
        } else {
            nextDate = calculateNextDueDate(task, startDate);
        }
    }

    for (let i = 0; i < 6 && nextDate; i++) {
        if (task.recurrence_end_date) {
            const endDate = new Date(task.recurrence_end_date);
            if (nextDate > endDate) {
                break;
            }
        }

        iterations.push({
            date: processDueDateForResponse(
                nextDate,
                getSafeTimezone(userTimezone)
            ),
            utc_date: nextDate.toISOString(),
        });

        if (task.recurrence_type === 'daily') {
            nextDate = new Date(nextDate);
            nextDate.setUTCDate(
                nextDate.getUTCDate() + (task.recurrence_interval || 1)
            );
        } else if (task.recurrence_type === 'weekly') {
            nextDate = new Date(nextDate);

            // Handle multiple weekdays
            if (task.recurrence_weekdays) {
                const weekdays = Array.isArray(task.recurrence_weekdays)
                    ? task.recurrence_weekdays
                    : JSON.parse(task.recurrence_weekdays);
                const interval = task.recurrence_interval || 1;
                const sorted = [...weekdays].sort((a, b) => a - b);
                const currentDay = nextDate.getUTCDay();
                const laterInWeek = sorted.filter((d) => d > currentDay);

                if (laterInWeek.length > 0) {
                    nextDate.setUTCDate(
                        nextDate.getUTCDate() + (laterInWeek[0] - currentDay)
                    );
                } else {
                    const daysToNextFirst =
                        (7 - currentDay + sorted[0]) % 7 || 7;
                    nextDate.setUTCDate(
                        nextDate.getUTCDate() +
                            daysToNextFirst +
                            (interval - 1) * 7
                    );
                }
            } else {
                // Old behavior for single weekday
                nextDate.setUTCDate(
                    nextDate.getUTCDate() + (task.recurrence_interval || 1) * 7
                );
            }
        } else {
            nextDate = calculateNextDueDate(task, nextDate);
        }
    }

    return iterations;
}

module.exports = {
    RECURRENCE_FIELDS,
    propagateRecurrenceToParent,
    planRecurrenceAdvance,
    handleRecurrenceUpdate,
    calculateNextIterations,
};
