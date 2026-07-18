import { Tag } from './Tag';
import { Person } from './Person';
import { Project } from './Project';
import { Area } from './Area';
import { Attachment } from './Attachment';

export interface Task {
    id?: number;
    uid?: string;
    name: string;
    original_name?: string;
    status: StatusType | number;
    priority?: PriorityType | number;
    due_date?: string;
    defer_until?: string;
    reminder_at?: string;
    note?: string;
    tags?: Tag[];
    project_id?: number;
    project_uid?: string;
    Project?: Project;
    area_id?: number;
    area_uid?: string;
    Area?: Area;
    created_at?: string;
    updated_at?: string;
    recurrence_type?: RecurrenceType;
    recurrence_interval?: number;
    recurrence_end_date?: string;
    recurrence_weekday?: number;
    recurrence_weekdays?: number[];
    recurrence_month_day?: number;
    recurrence_week_of_month?: number;
    completion_based?: boolean;
    recurring_parent_id?: number;
    recurring_parent_uid?: string;
    completed_at: string | null;
    // Plan 50: timestamp when status transitioned to waiting. Cleared on
    // transition out of waiting. Drives follow-up overdue filter.
    waiting_since?: string | null;
    parent_task_id?: number;
    subtasks?: Task[];
    parent_child_logic_executed?: boolean;
    attachments?: Attachment[];
    habit_mode?: boolean;
    habit_target_count?: number;
    habit_frequency_period?: 'daily' | 'weekly' | 'monthly';
    habit_streak_mode?: 'calendar' | 'scheduled';
    habit_flexibility_mode?: 'strict' | 'flexible';
    habit_current_streak?: number;
    habit_best_streak?: number;
    habit_total_completions?: number;
    habit_last_completion_at?: string;
    assigned_to?: string | null;
    involves?: string[];
    // Plan 49: native Someday/Maybe flag (list membership, not lifecycle).
    is_someday?: boolean;
    // Plan 51: mental-energy level (0=low, 1=medium, 2=high). Distinct axis
    // from priority. null = unset.
    energy?: 0 | 1 | 2 | null;
    // @mention link (many-to-many, parity with tags)
    InvolvedPeople?: Person[];
    AssignedTo?: Person;
    people?: Array<{ uid?: string; name: string }>;
    // Transient UI field set by suggestion scoring - never persisted or sent to server
    _suggestionMeta?: {
        score: number;
        reason: 'area_balance' | 'due' | 'goal' | 'fits_now' | 'revive' | 'high' | 'aging_review' | 'next_step';
        reasonLabel: string;
        reasonColor: string;
    };
}

export type StatusType =
    | 'not_started'
    | 'in_progress'
    | 'done'
    | 'archived'
    | 'waiting'
    | 'cancelled'
    | 'planned';
export type PriorityType = 'low' | 'medium' | 'high' | null | undefined;
export type RecurrenceType =
    | 'none'
    | 'daily'
    | 'weekly'
    | 'monthly'
    | 'monthly_weekday'
    | 'monthly_last_day';
