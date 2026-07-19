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

const VALID_ENERGY = ['low', 'medium', 'high'];

// Plan 51: saved-view energy filter ('low'|'medium'|'high'). null/undefined
// pass through (no filter); anything else rejects with 400.
function validateEnergy(energy) {
    if (energy === undefined || energy === null) {
        return null;
    }
    if (!VALID_ENERGY.includes(energy)) {
        throw new ValidationError('Invalid energy');
    }
    return energy;
}

// Plan 52: saved-view time-available filter (upper bound, in minutes).
// null/undefined pass through (no filter); non-positive or non-finite reject
// with 400.
function validateTimeMax(timeMax) {
    if (timeMax === undefined || timeMax === null) {
        return null;
    }
    const n = Number(timeMax);
    if (!Number.isFinite(n) || n < 1) {
        throw new ValidationError('Invalid time_max');
    }
    return n;
}

function validateName(name) {
    if (!name || name.trim() === '') {
        throw new ValidationError('View name is required');
    }
    return name.trim();
}

// Plan 57: saved-view OR tag filter. null/undefined pass through (no filter);
// array of non-empty strings kept; anything else rejects with 400.
function validateTagsAny(tagsAny) {
    if (tagsAny === undefined || tagsAny === null) {
        return null;
    }
    if (!Array.isArray(tagsAny)) {
        throw new ValidationError('tags_any must be an array');
    }
    return tagsAny.filter((t) => typeof t === 'string' && t.trim().length > 0);
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

module.exports = {
    validateName,
    validateExtras,
    validateEnergy,
    validateTimeMax,
    validateTagsAny,
};
