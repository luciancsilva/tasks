import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import TodayPlan from '../TodayPlan';
import { Task } from '../../../entities/Task';

jest.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (_key: string, fallback: string) => fallback }),
}));

// Mock TaskList to capture the onReorder callback that TodayPlan wires up,
// so we can assert the persistence contract without driving real dnd in jsdom.
let capturedReorder: ((reordered: Task[]) => void) | null = null;
jest.mock('../TaskList', () => {
    return function MockTaskList({
        tasks,
        onReorder,
    }: {
        tasks: Task[];
        onReorder: (reordered: Task[]) => void;
    }) {
        capturedReorder = onReorder;
        return (
            <div>
                {tasks.map((t) => (
                    <div key={t.name} data-testid={`mock-task-${t.name}`}>
                        {t.name}:{t.today_order ?? 'null'}
                    </div>
                ))}
            </div>
        );
    };
});

const baseTask = (overrides: Partial<Task>): Task =>
    ({
        name: 'task',
        status: 'not_started',
        completed_at: null,
        ...overrides,
    }) as Task;

const noop = () => Promise.resolve();

describe('TodayPlan (61) - manual reorder', () => {
    it('sorts by today_order when every task has one', () => {
        const tasks = [
            baseTask({ name: 'Zeta', today_order: 2 }),
            baseTask({ name: 'Alpha', today_order: 0 }),
            baseTask({ name: 'Mid', today_order: 1 }),
        ];
        render(
            <TodayPlan
                todayPlanTasks={tasks}
                projects={[]}
                onTaskUpdate={noop}
                onTaskDelete={noop}
            />
        );
        const items = screen.getAllByTestId(/^mock-task-/);
        expect(items[0]).toHaveTextContent('Alpha');
        expect(items[1]).toHaveTextContent('Mid');
        expect(items[2]).toHaveTextContent('Zeta');
    });

    it('falls back to default sort when any task has null today_order', () => {
        // No today_order on any -> fallback path. In-progress first, then by
        // priority/due. Here both not_started, equal priority -> stable input order.
        const tasks = [
            baseTask({ name: 'First' }),
            baseTask({ name: 'Second' }),
        ];
        render(
            <TodayPlan
                todayPlanTasks={tasks}
                projects={[]}
                onTaskUpdate={noop}
                onTaskDelete={noop}
            />
        );
        const items = screen.getAllByTestId(/^mock-task-/);
        expect(items.map((i) => i.textContent)).toEqual([
            'First:null',
            'Second:null',
        ]);
    });

    it('persists new today_order via onTaskUpdate when a row is dragged', async () => {
        const onTaskUpdate = jest.fn().mockResolvedValue(undefined);
        const tasks = [
            baseTask({ name: 'A', today_order: 0 }),
            baseTask({ name: 'B', today_order: 1 }),
        ];
        render(
            <TodayPlan
                todayPlanTasks={tasks}
                projects={[]}
                onTaskUpdate={onTaskUpdate}
                onTaskDelete={noop}
            />
        );
        // Simulate TaskList dragging B before A and reporting the reordered list.
        expect(capturedReorder).not.toBeNull();
        // Drag B before A: arrayMove yields [B, A], but each task still
        // carries its OLD today_order. handleReorder reassigns sequential
        // indices and persists only the ones that changed.
        const reordered: Task[] = [
            baseTask({ name: 'B', today_order: 1 }),
            baseTask({ name: 'A', today_order: 0 }),
        ];
        await capturedReorder!(reordered);
        // handleReorder reassigns: B->0 (was 1), A->1 (was 0). Both changed.
        expect(onTaskUpdate).toHaveBeenCalledWith(
            expect.objectContaining({ name: 'B', today_order: 0 })
        );
        expect(onTaskUpdate).toHaveBeenCalledWith(
            expect.objectContaining({ name: 'A', today_order: 1 })
        );
        expect(onTaskUpdate).toHaveBeenCalledTimes(2);
    });
});
