import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import TaskWaitingSinceCard from '../TaskWaitingSinceCard';
import { Task } from '../../../../entities/Task';

jest.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key: string, fallback: string) => fallback }),
}));

const baseTask: Task = {
    name: 'Test waiting',
    status: 'waiting',
    completed_at: null,
};

describe('TaskWaitingSinceCard', () => {
    it('renders nothing when task status is not waiting', () => {
        const { container } = render(
            <TaskWaitingSinceCard
                task={{ ...baseTask, status: 'not_started' }}
                onAdjust={jest.fn().mockResolvedValue(undefined)}
            />
        );
        expect(container.firstChild).toBeNull();
    });

    it('renders when task status is "waiting" string', () => {
        render(
            <TaskWaitingSinceCard
                task={{
                    ...baseTask,
                    status: 'waiting',
                    waiting_since: '2026-01-01T00:00:00.000Z',
                }}
                onAdjust={jest.fn().mockResolvedValue(undefined)}
            />
        );
        expect(screen.getByTestId('task-waiting-since-input')).toBeInTheDocument();
    });

    it('renders when task status is the integer 4', () => {
        render(
            <TaskWaitingSinceCard
                task={{
                    ...baseTask,
                    status: 4 as any,
                    waiting_since: '2026-01-01T00:00:00.000Z',
                }}
                onAdjust={jest.fn().mockResolvedValue(undefined)}
            />
        );
        expect(screen.getByTestId('task-waiting-since-input')).toBeInTheDocument();
    });

    it('clear button invokes onAdjust(null)', async () => {
        const onAdjust = jest.fn().mockResolvedValue(undefined);
        render(
            <TaskWaitingSinceCard
                task={{
                    ...baseTask,
                    status: 'waiting',
                    waiting_since: '2026-01-01T00:00:00.000Z',
                }}
                onAdjust={onAdjust}
            />
        );
        fireEvent.click(screen.getByTestId('task-waiting-since-clear'));
        expect(onAdjust).toHaveBeenCalledWith(null);
    });
});
