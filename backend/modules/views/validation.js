'use strict';

const { ValidationError } = require('../../shared/errors');

const VALID_TASK_STATUSES = [
    'not_started',
    'in_progress',
    'done',
    'archived',
    'waiting',
    'cancelled',
    'planned',
];

function validateName(name) {
    if (!name || name.trim() === '') {
        throw new ValidationError('View name is required');
    }
    return name.trim();
}

// `extras` carries two unrelated shapes in the same TEXT+JSON column:
//   - the legacy array of string flags (recurring, overdue, has_content, ...),
//     consumed by the search service;
//   - the GTD filter object { task_status?, assigned_to? } added by plan 16.
// Arrays and empty values pass through untouched (full retrocompat); only the
// object's known keys get validated.
function validateExtras(extras) {
    if (extras === undefined || extras === null || Array.isArray(extras)) {
        return extras;
    }
    if (typeof extras !== 'object') {
        throw new ValidationError('extras must be an object or array');
    }
    if (extras.task_status !== undefined && extras.task_status !== null) {
        if (!VALID_TASK_STATUSES.includes(extras.task_status)) {
            throw new ValidationError('Invalid task_status in extras');
        }
    }
    if (extras.assigned_to !== undefined && extras.assigned_to !== null) {
        if (
            typeof extras.assigned_to !== 'string' ||
            extras.assigned_to.trim() === ''
        ) {
            throw new ValidationError('Invalid assigned_to in extras');
        }
    }
    return extras;
}

module.exports = { validateName, validateExtras };
