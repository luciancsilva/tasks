import { applyExtrasFilter, getExtrasObject } from '../viewExtras';
import { Task } from '../../entities/Task';

const makeTask = (partial: Partial<Task>): Task =>
    ({
        id: Math.floor(Math.random() * 1e6),
        name: 'task',
        status: 0,
        ...partial,
    }) as Task;

describe('getExtrasObject', () => {
    it('returns null for the legacy array shape', () => {
        expect(getExtrasObject(['recurring', 'overdue'])).toBeNull();
    });

    it('returns null for empty / nullish extras', () => {
        expect(getExtrasObject([])).toBeNull();
        expect(getExtrasObject(null)).toBeNull();
        expect(getExtrasObject(undefined)).toBeNull();
    });

    it('returns the object shape untouched', () => {
        expect(getExtrasObject({ task_status: 'waiting' })).toEqual({
            task_status: 'waiting',
        });
    });
});

describe('applyExtrasFilter', () => {
    it('keeps only waiting tasks (status as number or string)', () => {
        const tasks = [
            makeTask({ name: 'a', status: 4 }), // waiting numeric
            makeTask({ name: 'b', status: 'waiting' }), // waiting string
            makeTask({ name: 'c', status: 0 }), // not_started
            makeTask({ name: 'd', status: 'in_progress' }),
        ];

        const result = applyExtrasFilter(tasks, { task_status: 'waiting' });

        expect(result.map((t) => t.name)).toEqual(['a', 'b']);
    });

    it('keeps only tasks assigned to the given person uid', () => {
        const tasks = [
            makeTask({ name: 'a', assigned_to: 'uid-1' }),
            makeTask({ name: 'b', assigned_to: 'uid-2' }),
            makeTask({ name: 'c', assigned_to: null }),
        ];

        const result = applyExtrasFilter(tasks, { assigned_to: 'uid-1' });

        expect(result.map((t) => t.name)).toEqual(['a']);
    });

    it('combines status and person filters', () => {
        const tasks = [
            makeTask({ name: 'a', status: 4, assigned_to: 'uid-1' }),
            makeTask({ name: 'b', status: 4, assigned_to: 'uid-2' }),
            makeTask({ name: 'c', status: 0, assigned_to: 'uid-1' }),
        ];

        const result = applyExtrasFilter(tasks, {
            task_status: 'waiting',
            assigned_to: 'uid-1',
        });

        expect(result.map((t) => t.name)).toEqual(['a']);
    });

    it('returns tasks untouched for legacy array or empty extras', () => {
        const tasks = [makeTask({ name: 'a' }), makeTask({ name: 'b' })];
        expect(applyExtrasFilter(tasks, ['recurring'])).toBe(tasks);
        expect(applyExtrasFilter(tasks, null)).toBe(tasks);
    });
});
