'use strict';

const { Op } = require('sequelize');
const {
    Task,
    RecurringCompletion,
    Project,
    sequelize,
} = require('../../models');
const taskRepository = require('./repository');
const { serializeTask, serializeTasks } = require('./core/serializers');
const { getTaskMetrics } = require('./queries/metrics-computation');
const {
    getSubtasks,
    createSubtasks,
    updateSubtasks,
} = require('./operations/subtasks');
const {
    RECURRENCE_FIELDS,
    propagateRecurrenceToParent,
    planRecurrenceAdvance,
    handleRecurrenceUpdate,
    calculateNextIterations,
} = require('./operations/recurring');
const { updateTaskTags } = require('./operations/tags');
const { updateTaskPeople } = require('./operations/people');
const { handleCompletionStatus } = require('./operations/completion');
const {
    handleParentChildOnStatusChange,
} = require('./operations/parent-child');
const { captureOldValues, logTaskChanges } = require('./utils/logging');
const { deleteAttachmentsForTaskIds } = require('./attachmentCleanup');
const { logEvent } = require('./taskEventService');
const {
    buildTaskAttributes,
    buildUpdateAttributes,
} = require('./core/builders');
const { filterTasksByParams } = require('./queries/query-builders');
const {
    expandRecurringTasks,
    handleRecurringTasks,
    buildGroupedTasks,
    serializeGroupedTasks,
    addDashboardLists,
} = require('./operations/list');
const { TASK_INCLUDES_WITH_SUBTASKS } = require('./utils/constants');
const permissionsService = require('../../services/permissionsService');
const {
    validateProjectAccess,
    validateParentTaskAccess,
    validateDeferUntilAndDueDate,
    validateAreaAccess,
} = require('./utils/validation');
const {
    getSafeTimezone,
    getTodayBoundsInUTC,
    getUpcomingRangeInUTC,
} = require('../../utils/timezone-utils');
const { isValidUid } = require('../../utils/slug-utils');
const { logError } = require('../../services/logService');
const {
    ValidationError,
    NotFoundError,
    ForbiddenError,
} = require('../../shared/errors');

/**
 * Fetches the recurrence end date for a recurring parent task.
 * Used for validating defer_until dates on recurring task instances.
 *
 * @param {number|null|undefined} recurringParentId - The ID of the recurring parent task
 * @param {number} userId - The user ID for access control
 * @returns {Promise<Date|null|undefined>} The parent's recurrence_end_date, null (infinite), or undefined (no parent)
 *          - undefined: no recurring parent (not a recurring instance)
 *          - null: recurring parent with no end date (infinite recurrence)
 *          - Date: recurring parent with specific end date
 */
async function getRecurringParentEndDate(recurringParentId, userId) {
    // No parent ID provided - not a recurring instance
    if (!recurringParentId) return undefined;

    const parent = await taskRepository.findByIdAndUser(
        recurringParentId,
        userId
    );

    // Parent not found or no access - treat as non-recurring (undefined)
    if (!parent) return undefined;

    // Return the end date (null for infinite, Date for specific end)
    return parent.recurrence_end_date;
}

/**
 * Resolves a project reference, translating the validator's generic failures
 * into domain errors.
 */
async function resolveProjectReference(identifier, userId) {
    try {
        return await validateProjectAccess(identifier, userId);
    } catch (error) {
        if (error.message === 'Forbidden') {
            throw new ForbiddenError();
        }
        throw new ValidationError(error.message);
    }
}

/**
 * Builds the response for a task whose post-write reload came back empty.
 */
function buildFallbackTask(task) {
    return {
        ...task.toJSON(),
        tags: [],
        Project: null,
        subtasks: [],
        today_move_count: 0,
        due_date: task.due_date
            ? task.due_date instanceof Date
                ? task.due_date.toISOString().split('T')[0]
                : new Date(task.due_date).toISOString().split('T')[0]
            : null,
        completed_at: task.completed_at
            ? task.completed_at instanceof Date
                ? task.completed_at.toISOString()
                : new Date(task.completed_at).toISOString()
            : null,
    };
}

/**
 * Projects due within the upcoming window, owned by or shared with the user.
 */
async function findUpcomingProjects(userId, timezone) {
    const safeTimezone = getSafeTimezone(timezone);
    const upcomingRange = getUpcomingRangeInUTC(safeTimezone, 7);

    const ownedOrShared = await permissionsService.ownershipOrPermissionWhere(
        'project',
        userId
    );

    return Project.findAll({
        where: {
            ...ownedOrShared,
            due_date_at: {
                [Op.between]: [upcomingRange.start, upcomingRange.end],
            },
            status: {
                [Op.notIn]: ['completed', 'archived'],
            },
        },
        order: [['due_date_at', 'ASC']],
    });
}

/**
 * Drops recurring parents that already have a concrete instance due today, so
 * the Today view shows the instance rather than both.
 */
function dropParentsWithTodayInstances(tasks, timezone) {
    const safeTimezone = getSafeTimezone(timezone);
    const todayBounds = getTodayBoundsInUTC(safeTimezone);

    const instancesForToday = tasks.filter(
        (t) =>
            t.recurring_parent_id &&
            t.due_date &&
            new Date(t.due_date) >= todayBounds.start &&
            new Date(t.due_date) <= todayBounds.end
    );

    const parentIdsWithTodayInstances = new Set(
        instancesForToday.map((t) => t.recurring_parent_id)
    );

    return tasks.filter(
        (t) =>
            !t.recurrence_type ||
            t.recurrence_type === 'none' ||
            t.recurring_parent_id !== null ||
            !parentIdsWithTodayInstances.has(t.id)
    );
}

/**
 * Tasks service - business logic, free of HTTP concerns.
 */
const tasksService = {
    /**
     * Task metrics for the given view type.
     */
    async getMetrics(userId, timezone, type) {
        return getTaskMetrics(userId, timezone, type);
    },

    /**
     * Builds the task list for a view (today, upcoming, calendar, ...),
     * including grouping, pagination and the dashboard lists.
     */
    async list(userId, timezone, language, query) {
        const {
            type,
            groupBy,
            maxDays,
            order_by,
            include_lists,
            limit: limitParam,
            offset: offsetParam,
        } = query;

        await handleRecurringTasks(userId, type);

        let tasks = await filterTasksByParams(query, userId, timezone);

        const upcomingProjects =
            type === 'upcoming'
                ? await findUpcomingProjects(userId, timezone)
                : [];

        if (type === 'upcoming' && groupBy === 'day') {
            const days = maxDays ? parseInt(maxDays, 10) : 7;
            tasks = expandRecurringTasks(
                tasks,
                days,
                query.status,
                getSafeTimezone(timezone)
            );
        }

        if (type === 'today') {
            tasks = dropParentsWithTodayInstances(tasks, timezone);
        }

        const hasPagination =
            limitParam !== undefined || offsetParam !== undefined;
        const totalCount = tasks.length;
        let paginatedTasks = tasks;
        const limit = parseInt(limitParam, 10) || 20;
        const offset = parseInt(offsetParam, 10) || 0;

        if (hasPagination) {
            paginatedTasks = tasks.slice(offset, offset + limit);
        }

        const groupedTasks = await buildGroupedTasks(
            paginatedTasks,
            type,
            groupBy,
            maxDays,
            order_by,
            timezone,
            language || 'en'
        );

        const serializationOptions =
            type === 'today' || type === 'calendar'
                ? { preserveOriginalName: true }
                : {};

        const response = {
            tasks: await serializeTasks(
                paginatedTasks,
                timezone,
                serializationOptions
            ),
        };

        const serializedGrouped = await serializeGroupedTasks(
            groupedTasks,
            timezone
        );
        if (serializedGrouped) {
            response.groupedTasks = serializedGrouped;
        }

        if (type === 'upcoming' && upcomingProjects.length > 0) {
            response.projects = upcomingProjects.map((project) => ({
                id: project.id,
                uid: project.uid,
                name: project.name,
                status: project.status,
                priority: project.priority,
                due_date_at: project.due_date_at,
                created_at: project.created_at,
                updated_at: project.updated_at,
            }));
        }

        await addDashboardLists(
            response,
            userId,
            timezone,
            type,
            include_lists,
            serializationOptions
        );

        if (hasPagination) {
            response.pagination = {
                total: totalCount,
                limit: limit,
                offset: offset,
                hasMore: offset + paginatedTasks.length < totalCount,
            };
        }

        return response;
    },

    /**
     * Creates a task with its tags and subtasks.
     *
     * Returns `{ task, isFallback }`; `isFallback` marks a task whose reload
     * came back empty, so the caller can tell a full response from a degraded
     * one.
     */
    async create(userId, userTimezone, body) {
        const {
            name,
            project_id,
            project_uid,
            area_id,
            area_uid,
            parent_task_id,
            tags,
            Tags,
            people,
            People,
            subtasks,
        } = body;
        const tagsData = tags || Tags;
        const peopleData = people || People;

        if (!name || name.trim() === '') {
            throw new ValidationError('Task name is required.');
        }

        const timezone = getSafeTimezone(userTimezone);
        const taskAttributes = buildTaskAttributes(body, userId, timezone);

        // Plan 50: when creating directly in status=waiting, auto-set
        // waiting_since to "now" unless caller supplied an explicit value.
        if (
            taskAttributes.status === Task.STATUS.WAITING &&
            body.waiting_since === undefined
        ) {
            taskAttributes.waiting_since = new Date();
        } else if (
            taskAttributes.status === Task.STATUS.WAITING &&
            body.waiting_since !== undefined
        ) {
            taskAttributes.waiting_since = body.waiting_since;
        }

        try {
            // Fetch parent end date if this is a recurring instance
            const recurringParentEndDate = await getRecurringParentEndDate(
                body.recurring_parent_id,
                userId
            );

            validateDeferUntilAndDueDate(
                taskAttributes.defer_until,
                taskAttributes.due_date,
                recurringParentEndDate
            );
        } catch (error) {
            throw new ValidationError(error.message);
        }

        const validProjectId = await resolveProjectReference(
            project_uid || project_id,
            userId
        );
        if (validProjectId) taskAttributes.project_id = validProjectId;

        try {
            const validAreaId = await validateAreaAccess(
                area_uid || area_id,
                userId
            );
            if (validAreaId) taskAttributes.area_id = validAreaId;
        } catch (error) {
            throw new ValidationError(error.message);
        }

        try {
            const validParentId = await validateParentTaskAccess(
                parent_task_id,
                userId
            );
            if (validParentId) taskAttributes.parent_task_id = validParentId;
        } catch (error) {
            throw new ValidationError(error.message);
        }

        const task = await sequelize.transaction(async (t) => {
            const created = await taskRepository.create(taskAttributes, {
                transaction: t,
            });
            await updateTaskTags(created, tagsData, userId, { transaction: t });
            await updateTaskPeople(created, peopleData, userId, {
                transaction: t,
            });
            await createSubtasks(created.id, subtasks, userId, {
                transaction: t,
            });
            return created;
        });

        const taskWithAssociations = await taskRepository.findById(task.id, {
            include: TASK_INCLUDES_WITH_SUBTASKS,
        });

        if (!taskWithAssociations) {
            logError('Failed to reload created task:', task.id);
            return { task: buildFallbackTask(task), isFallback: true };
        }

        const serializedTask = await serializeTask(
            taskWithAssociations,
            userTimezone,
            { skipDisplayNameTransform: true }
        );

        return { task: serializedTask, isFallback: false };
    },

    /**
     * Updates a task: recurrence, completion, references, tags and subtasks.
     */
    async update(userId, userTimezone, uid, body) {
        const {
            status,
            project_id,
            project_uid,
            area_id,
            area_uid,
            parent_task_id,
            tags,
            Tags,
            people,
            People,
            subtasks,
            update_parent_recurrence,
        } = body;

        const tagsData = tags || Tags;
        const peopleData = people || People;

        const task = await taskRepository.findByUid(uid, {
            include: TASK_INCLUDES_WITH_SUBTASKS,
        });

        if (!task) {
            throw new NotFoundError('Task not found.');
        }

        const oldValues = captureOldValues(task);
        const oldStatus = task.status;

        if (update_parent_recurrence) {
            await propagateRecurrenceToParent(task, body, userId);
        }

        const timezone = getSafeTimezone(userTimezone);
        const taskAttributes = buildUpdateAttributes(body, task, timezone);

        // Plan 50: auto-set/clear waiting_since on status transition.
        // Logic runs before validateDeferUntilAndDueDate so the new value
        // is reflected in any cascading checks.
        {
            const prevStatus = oldStatus;
            const nextStatus =
                body.status !== undefined
                    ? Task.getStatusValue(body.status)
                    : prevStatus;
            if (
                nextStatus === Task.STATUS.WAITING &&
                prevStatus !== Task.STATUS.WAITING
            ) {
                if (body.waiting_since === undefined) {
                    taskAttributes.waiting_since = new Date();
                } else if (body.waiting_since !== undefined) {
                    taskAttributes.waiting_since = body.waiting_since;
                }
            } else if (
                nextStatus !== Task.STATUS.WAITING &&
                prevStatus === Task.STATUS.WAITING
            ) {
                taskAttributes.waiting_since = null;
            }
            // Explicit body.waiting_since override always wins when
            // staying in waiting.
            if (
                body.waiting_since !== undefined &&
                nextStatus === Task.STATUS.WAITING
            ) {
                taskAttributes.waiting_since = body.waiting_since;
            }
        }

        try {
            const finalDeferUntil =
                taskAttributes.defer_until !== undefined
                    ? taskAttributes.defer_until
                    : task.defer_until;
            const finalDueDate =
                taskAttributes.due_date !== undefined
                    ? taskAttributes.due_date
                    : task.due_date;

            // Fetch parent end date if this is a recurring instance
            const recurringParentEndDate = await getRecurringParentEndDate(
                task.recurring_parent_id,
                userId
            );

            validateDeferUntilAndDueDate(
                finalDeferUntil,
                finalDueDate,
                recurringParentEndDate
            );
        } catch (error) {
            throw new ValidationError(error.message);
        }

        await handleCompletionStatus(taskAttributes, status, task);

        const projectIdentifier =
            project_uid !== undefined ? project_uid : project_id;
        if (projectIdentifier !== undefined) {
            taskAttributes.project_id = await resolveProjectReference(
                projectIdentifier,
                userId
            );
        }

        const areaIdentifier = area_uid !== undefined ? area_uid : area_id;
        if (areaIdentifier !== undefined) {
            try {
                const validAreaId = await validateAreaAccess(
                    areaIdentifier,
                    userId
                );
                taskAttributes.area_id = validAreaId;
            } catch (error) {
                throw new ValidationError(error.message);
            }
        }

        if (parent_task_id !== undefined) {
            if (parent_task_id && parent_task_id.toString().trim()) {
                try {
                    const validParentId = await validateParentTaskAccess(
                        parent_task_id,
                        userId
                    );
                    taskAttributes.parent_task_id = validParentId;
                } catch (error) {
                    throw new ValidationError(error.message);
                }
            } else {
                taskAttributes.parent_task_id = null;
            }
        }

        await handleRecurrenceUpdate(task, RECURRENCE_FIELDS, body);

        const resolveFinalValue = (field) =>
            taskAttributes[field] !== undefined
                ? taskAttributes[field]
                : task[field];

        const advance = planRecurrenceAdvance(
            task,
            taskAttributes,
            status,
            resolveFinalValue
        );

        if (advance?.shouldAdvance) {
            taskAttributes.status = Task.STATUS.NOT_STARTED;
            taskAttributes.completed_at = null;
            taskAttributes.due_date = advance.advanceInfo.nextDueDate;
        }

        // Atomically apply the task mutation and every dependent write (parent
        // child cascade, recurring completion, tags, people, subtasks) so a
        // failure in any of them rolls the whole update back. Parent-child
        // cascade stays inside the block and before updateSubtasks to preserve
        // the original execution order (explicit subtask changes win over the
        // status cascade). All helpers receive the transaction to avoid
        // SQLITE_BUSY from a second pool connection.
        await sequelize.transaction(async (t) => {
            await task.update(taskAttributes, { transaction: t });

            // Defensive check: ensure completed_at is null if status is not DONE
            if (
                taskAttributes.status !== undefined &&
                taskAttributes.status !== Task.STATUS.DONE &&
                taskAttributes.status !== 'done' &&
                task.completed_at !== null
            ) {
                await task.update({ completed_at: null }, { transaction: t });
            }

            if (status !== undefined) {
                await handleParentChildOnStatusChange(
                    task,
                    oldStatus,
                    taskAttributes.status,
                    userId,
                    { transaction: t }
                );
            }

            if (advance) {
                await RecurringCompletion.create(advance.completionPayload, {
                    transaction: t,
                });
            }

            await updateTaskTags(task, tagsData, userId, { transaction: t });
            await updateTaskPeople(task, peopleData, userId, {
                transaction: t,
            });
            await updateSubtasks(task.id, subtasks, userId, { transaction: t });
        });

        // Best-effort event logging runs after commit so it never rolls back a
        // successful update and never contends for the DB lock. Both helpers
        // swallow their own errors.
        if (advance) {
            await this.logRecurringCompletion(task.id, userId, advance);
        }
        await logTaskChanges(task, oldValues, body, tagsData, userId);

        const taskWithAssociations = await taskRepository.findById(task.id, {
            include: TASK_INCLUDES_WITH_SUBTASKS,
        });

        return serializeTask(taskWithAssociations, userTimezone, {
            skipDisplayNameTransform: true,
        });
    },

    /**
     * Records the completion of one recurring occurrence. A failure here must
     * not fail the update itself.
     */
    async logRecurringCompletion(taskId, userId, advance) {
        const { advanceInfo, completionBased } = advance;
        try {
            await logEvent({
                taskId,
                userId,
                eventType: 'recurring_occurrence_completed',
                fieldName: 'recurrence',
                oldValue: advanceInfo ? advanceInfo.originalDueDate : null,
                newValue: advanceInfo ? advanceInfo.nextDueDate : null,
                metadata: {
                    action: 'recurring_occurrence_completed',
                    original_due_date:
                        advanceInfo?.originalDueDate?.toISOString?.() ??
                        advanceInfo?.originalDueDate,
                    next_due_date:
                        advanceInfo?.nextDueDate?.toISOString?.() ?? null,
                    completion_based: completionBased,
                },
            });
        } catch (eventError) {
            logError(
                'Error logging recurring occurrence completion event:',
                eventError
            );
        }
    },

    /**
     * Deletes a task, its attachments and its subtasks.
     *
     * Recurring children are split: future instances are deleted with the
     * series, while past ones are detached into standalone tasks so completed
     * history survives.
     */
    async delete(uid) {
        const task = await taskRepository.findByUid(uid);

        if (!task) {
            throw new NotFoundError('Task not found.');
        }

        const taskId = task.id;

        const subtasks = await taskRepository.findAll(
            { parent_task_id: taskId },
            { attributes: ['id'] }
        );
        const subtaskIds = subtasks.map((subtask) => subtask.id);

        const childTasks = await taskRepository.findRecurringChildren(taskId);

        await sequelize.transaction(async (t) => {
            if (childTasks.length > 0) {
                const now = new Date();

                const futureInstances = childTasks.filter((child) => {
                    if (!child.due_date) return true;
                    return new Date(child.due_date) > now;
                });

                const pastInstances = childTasks.filter((child) => {
                    if (!child.due_date) return false;
                    return new Date(child.due_date) <= now;
                });

                // Remove attachments of future instances
                await deleteAttachmentsForTaskIds(
                    futureInstances.map((instance) => instance.id),
                    { transaction: t }
                );

                for (const futureInstance of futureInstances) {
                    await futureInstance.destroy({ transaction: t });
                }

                for (const pastInstance of pastInstances) {
                    await pastInstance.update(
                        {
                            recurring_parent_id: null,
                            recurrence_type: 'none',
                            recurrence_interval: null,
                            recurrence_end_date: null,
                            recurrence_weekday: null,
                            recurrence_month_day: null,
                            recurrence_week_of_month: null,
                            completion_based: false,
                        },
                        { transaction: t }
                    );
                }
            }

            // Remove attachments (R2 objects + rows) of the task and its subtasks
            await deleteAttachmentsForTaskIds([taskId, ...subtaskIds], {
                transaction: t,
            });

            // Clear recurring parent relationships
            await taskRepository.clearRecurringParent(taskId, {
                transaction: t,
            });

            // The task itself (subtasks and all other dependents will be deleted by database ON DELETE CASCADE)
            await task.destroy({ force: true, transaction: t });
        });

        return { message: 'Task successfully deleted' };
    },

    /**
     * A single task with its associations, serialized for the API.
     */
    async getByUid(uid, timezone) {
        const task = await taskRepository.findByUid(uid, {
            include: TASK_INCLUDES_WITH_SUBTASKS,
        });

        if (!task) {
            throw new NotFoundError('Task not found.');
        }

        return serializeTask(task, timezone, {
            skipDisplayNameTransform: true,
        });
    },

    /**
     * Subtasks of a task. An unknown task yields an empty list rather than a
     * 404, so the UI can render a task that lost its parent.
     */
    async listSubtasks(uid, userId, timezone) {
        if (!isValidUid(uid)) {
            throw new ValidationError('Invalid UID');
        }

        const task = await taskRepository.findByUid(uid);
        if (!task) {
            return [];
        }

        const result = await getSubtasks(task.id, userId, timezone);

        if (result.error === 'Forbidden') {
            throw new ForbiddenError();
        }

        if (result.error === 'Not found') {
            return [];
        }

        return result.subtasks;
    },

    /**
     * Upcoming occurrences of a recurring task. Non-recurring tasks yield an
     * empty list.
     */
    async getNextIterations(uid, userId, timezone, startFromDate) {
        if (!isValidUid(uid)) {
            throw new ValidationError('Invalid UID');
        }

        const task = await taskRepository.findByUid(uid);

        if (!task) {
            throw new NotFoundError('Task not found');
        }

        if (task.user_id !== userId) {
            throw new ForbiddenError('Access denied');
        }

        if (!task.recurrence_type || task.recurrence_type === 'none') {
            return [];
        }

        return calculateNextIterations(task, startFromDate, timezone);
    },
};

module.exports = tasksService;
