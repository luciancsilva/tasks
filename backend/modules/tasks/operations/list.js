const { groupTasksByDay } = require('./grouping');
const { serializeTasks } = require('../core/serializers');
const { computeTaskMetrics } = require('../queries/metrics-computation');
const {
    calculateNextDueDate,
    calculateVirtualOccurrences,
} = require('../recurringTaskService');

/**
 * Replaces each recurring parent task with its virtual occurrences over the
 * next `maxDays`, leaving non-recurring tasks untouched.
 */
function expandRecurringTasks(
    tasks,
    maxDays = 7,
    statusFilter = null,
    userTimezone = 'UTC'
) {
    const expandedTasks = [];
    const moment = require('moment-timezone');
    const now = moment.tz(userTimezone).startOf('day').toDate();

    tasks.forEach((task) => {
        const isRecurring =
            task.recurrence_type &&
            task.recurrence_type !== 'none' &&
            !task.recurring_parent_id;

        if (!isRecurring) {
            expandedTasks.push(task);
            return;
        }

        console.log('[DEBUG] Processing recurring task:', {
            id: task.id,
            name: task.name,
            recurrence_type: task.recurrence_type,
            due_date: task.due_date,
            status: task.status,
            completed_at: task.completed_at,
            has_due_date: !!task.due_date,
            statusFilter: statusFilter,
        });

        if (
            (statusFilter === 'completed' || statusFilter === 'done') &&
            (task.status === 2 || task.status === 'done')
        ) {
            console.log(
                '[DEBUG] Task is completed and filter is completed, showing actual task'
            );
            expandedTasks.push(task);
            return;
        }

        let startFrom = task.due_date ? new Date(task.due_date) : now;

        if (task.status === 2 || task.status === 'done') {
            const baseDate =
                task.completion_based && task.completed_at
                    ? new Date(task.completed_at)
                    : new Date(task.due_date || now);
            const nextDate = calculateNextDueDate(task, baseDate);
            startFrom = nextDate || now;
            console.log(
                '[DEBUG] Task is completed, starting from next occurrence:',
                startFrom
            );
        } else if (startFrom < now) {
            let nextDate = startFrom;
            let iterations = 0;
            const MAX_ITERATIONS = 100;

            while (nextDate && nextDate < now && iterations < MAX_ITERATIONS) {
                nextDate = calculateNextDueDate(task, nextDate);
                iterations++;
            }

            startFrom = nextDate || now;
        }

        console.log('[DEBUG] Starting from date:', startFrom);
        const occurrences = calculateVirtualOccurrences(
            task,
            maxDays,
            startFrom,
            userTimezone
        );
        console.log('[DEBUG] Generated occurrences:', occurrences.length);

        occurrences.forEach((occurrence, index) => {
            const virtualTask = {
                ...(task.toJSON ? task.toJSON() : task),
                due_date: occurrence.due_date,
                is_virtual_occurrence: true,
                occurrence_index: index,
                virtual_id: `${task.id}_occurrence_${index}`,
            };
            expandedTasks.push(virtualTask);
        });
    });

    return expandedTasks;
}

async function handleRecurringTasks(userId, queryType) {
    return;
}

async function buildGroupedTasks(
    tasks,
    queryType,
    groupBy,
    maxDays,
    orderBy,
    timezone,
    language = 'en'
) {
    if (queryType !== 'upcoming' || groupBy !== 'day') {
        return null;
    }

    const days = maxDays ? parseInt(maxDays, 10) : 7;
    const dayGroupingOrderBy = orderBy || 'due_date:asc';

    return await groupTasksByDay(
        tasks,
        timezone,
        days,
        dayGroupingOrderBy,
        language
    );
}

async function serializeGroupedTasks(groupedTasks, timezone) {
    if (!groupedTasks) return null;

    const serialized = {};
    for (const [groupName, groupTasks] of Object.entries(groupedTasks)) {
        serialized[groupName] = await serializeTasks(groupTasks, timezone);
    }
    return serialized;
}

async function addDashboardLists(
    response,
    userId,
    timezone,
    queryType,
    includeLists,
    serializationOptions
) {
    if (queryType !== 'today' || includeLists !== 'true') {
        return;
    }

    const metricsData = await computeTaskMetrics(userId, timezone);

    const listKeys = [
        'tasks_in_progress',
        'tasks_today_plan',
        'tasks_due_today',
        'tasks_overdue',
        'suggested_tasks',
        'tasks_completed_today',
    ];

    const serializedLists = {};

    for (const key of listKeys) {
        const metricsKey =
            key === 'tasks_today_plan' ? 'today_plan_tasks' : key;
        serializedLists[key] = await serializeTasks(
            metricsData[metricsKey],
            timezone,
            serializationOptions
        );
    }

    Object.assign(response, serializedLists);
    response.dashboard_lists = serializedLists;
}

function addPerformanceHeaders(res, startTime, queryStats) {
    const totalTime = Date.now() - startTime;
    res.set('X-Response-Time', `${totalTime}ms`);
    res.set('X-Query-Count', queryStats.count.toString());
}

module.exports = {
    expandRecurringTasks,
    handleRecurringTasks,
    buildGroupedTasks,
    serializeGroupedTasks,
    addDashboardLists,
    addPerformanceHeaders,
};
