import {
    TaskEvent,
    TaskCompletionTime,
    ProductivityMetrics,
    CompletionAnalyticsResponse,
    TaskActivitySummary,
} from '../entities/TaskEvent';
import i18n from '../i18n';

const API_BASE = '/api';

/**
 * Get task timeline (all events for a specific task)
 */
export const getTaskTimeline = async (
    taskUid: string
): Promise<TaskEvent[]> => {
    const response = await fetch(`${API_BASE}/task/${taskUid}/timeline`, {
        credentials: 'include',
    });

    if (!response.ok) {
        throw new Error(
            i18n.t('timeline.fetchError', 'Failed to fetch task timeline')
        );
    }

    return response.json();
};

/**
 * Get task completion time analytics
 */
export const getTaskCompletionTime = async (
    taskUid: string
): Promise<TaskCompletionTime | null> => {
    const response = await fetch(
        `${API_BASE}/task/${taskUid}/completion-time`,
        {
            credentials: 'include',
        }
    );

    if (response.status === 404) {
        return null;
    }

    if (!response.ok) {
        throw new Error(
            i18n.t(
                'errors.fetchTaskCompletionTimeError',
                `Failed to fetch task completion time: ${response.statusText}`,
                { status: response.statusText }
            )
        );
    }

    return response.json();
};

/**
 * Get user productivity metrics
 */
export const getUserProductivityMetrics = async (
    startDate?: string,
    endDate?: string
): Promise<ProductivityMetrics> => {
    const params = new URLSearchParams();

    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);

    const response = await fetch(
        `${API_BASE}/user/productivity-metrics?${params}`,
        {
            credentials: 'include',
        }
    );

    if (!response.ok) {
        throw new Error(
            i18n.t(
                'errors.fetchProductivityMetricsError',
                `Failed to fetch productivity metrics: ${response.statusText}`,
                { status: response.statusText }
            )
        );
    }

    return response.json();
};

/**
 * Get user activity summary
 */
export const getUserActivitySummary = async (
    startDate: string,
    endDate: string
): Promise<TaskActivitySummary[]> => {
    const params = new URLSearchParams({
        startDate,
        endDate,
    });

    const response = await fetch(
        `${API_BASE}/user/activity-summary?${params}`,
        {
            credentials: 'include',
        }
    );

    if (!response.ok) {
        throw new Error(
            i18n.t(
                'errors.fetchActivitySummaryError',
                `Failed to fetch activity summary: ${response.statusText}`,
                { status: response.statusText }
            )
        );
    }

    return response.json();
};

/**
 * Get completion analytics for multiple tasks
 */
export const getCompletionAnalytics = async (
    options: {
        limit?: number;
        offset?: number;
        projectUid?: string;
    } = {}
): Promise<CompletionAnalyticsResponse> => {
    const params = new URLSearchParams();

    if (options.limit) params.append('limit', options.limit.toString());
    if (options.offset) params.append('offset', options.offset.toString());
    if (options.projectUid) params.append('projectUid', options.projectUid);

    const response = await fetch(
        `${API_BASE}/tasks/completion-analytics?${params}`,
        {
            credentials: 'include',
        }
    );

    if (!response.ok) {
        throw new Error(
            i18n.t(
                'errors.fetchCompletionAnalyticsError',
                `Failed to fetch completion analytics: ${response.statusText}`,
                { status: response.statusText }
            )
        );
    }

    return response.json();
};

/**
 * Format duration for display
 */
export const formatDuration = (hours: number): string => {
    if (hours < 1) {
        const minutes = Math.round(hours * 60);
        return `${minutes}m`;
    } else if (hours < 24) {
        const h = Math.floor(hours);
        const m = Math.round((hours - h) * 60);
        return m > 0 ? `${h}h ${m}m` : `${h}h`;
    } else {
        const days = Math.floor(hours / 24);
        const h = Math.floor(hours % 24);
        return h > 0 ? `${days}d ${h}h` : `${days}d`;
    }
};

/**
 * Get human-readable event type
 */
export const getEventTypeLabel = (eventType: string): string => {
    const labels: Record<string, string> = {
        created: i18n.t('timeline.events.taskCreated', 'Created'),
        status_changed: i18n.t('timeline.events.statusChanged', 'Status Changed'),
        priority_changed: i18n.t(
            'timeline.events.priorityChanged',
            'Priority Changed'
        ),
        due_date_changed: i18n.t('timeline.events.dueDateChanged', 'Due Date Changed'),
        defer_until_changed: i18n.t(
            'timeline.events.deferUntilChanged',
            'Defer Date Changed'
        ),
        project_changed: i18n.t('timeline.events.projectChanged', 'Project Changed'),
        name_changed: i18n.t('timeline.events.nameUpdated', 'Name Changed'),
        description_changed: i18n.t(
            'timeline.events.descriptionUpdated',
            'Description Changed'
        ),
        note_changed: i18n.t('timeline.events.noteUpdated', 'Note Changed'),
        completed: i18n.t('task.statusDone', 'Completed'),
        archived: i18n.t('timeline.events.taskArchived', 'Archived'),
        deleted: i18n.t('common.delete', 'Deleted'),
        restored: i18n.t('common.restore', 'Restored'),
        today_changed: i18n.t(
            'timeline.events.todayFlagChanged',
            'Today Flag Changed'
        ),
        tags_changed: i18n.t('timeline.events.tagsUpdated', 'Tags Changed'),
        recurrence_changed: i18n.t(
            'timeline.events.recurrenceTypeChanged',
            'Recurrence Changed'
        ),
    };

    return labels[eventType] || eventType;
};

/**
 * Get human-readable status value
 */
export const getStatusLabel = (status: number): string => {
    const statusLabels: Record<number, string> = {
        0: i18n.t('task.statusNotStarted', 'Not Started'),
        1: i18n.t('task.statusInProgress', 'In Progress'),
        2: i18n.t('task.statusDone', 'Completed'),
        3: i18n.t('task.statusArchived', 'Archived'),
        4: i18n.t('task.statusWaiting', 'Waiting'),
    };

    return statusLabels[status] || `Status ${status}`;
};

/**
 * Get human-readable priority value
 */
export const getPriorityLabel = (priority: number): string => {
    const priorityLabels: Record<number, string> = {
        0: i18n.t('common.priority.low', 'Low'),
        1: i18n.t('common.priority.medium', 'Medium'),
        2: i18n.t('common.priority.high', 'High'),
    };

    return priorityLabels[priority] || `Priority ${priority}`;
};
