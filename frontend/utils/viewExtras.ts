import { Task } from '../entities/Task';
import { getStatusValue } from '../constants/taskStatus';

// GTD filter object stored in View.extras (plan 16). The same column also
// carries a legacy array of string flags (recurring, overdue, ...) consumed by
// the search backend — hence the union shape everywhere extras is read.
export interface ViewExtras {
    task_status?: string;
    assigned_to?: string;
}

export type ViewExtrasField = string[] | ViewExtras | null | undefined;

// Returns the GTD object shape, or null when extras is the legacy array/empty.
export function getExtrasObject(extras: ViewExtrasField): ViewExtras | null {
    if (!extras || Array.isArray(extras)) return null;
    return extras;
}

// Filters tasks by the saved GTD extras (task status and/or assigned person).
// Tasks whose status arrives as string or number are both handled via
// getStatusValue normalization. No object extras => tasks returned untouched.
export function applyExtrasFilter<T extends Task>(
    tasks: T[],
    extras: ViewExtrasField
): T[] {
    const obj = getExtrasObject(extras);
    if (!obj) return tasks;

    let result = tasks;
    if (obj.task_status) {
        const target = getStatusValue(obj.task_status as never);
        result = result.filter(
            (task) => getStatusValue(task.status as never) === target
        );
    }
    if (obj.assigned_to) {
        result = result.filter((task) => task.assigned_to === obj.assigned_to);
    }
    return result;
}
