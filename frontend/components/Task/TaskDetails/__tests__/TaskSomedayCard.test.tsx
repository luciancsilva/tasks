import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import TaskSomedayCard from '../TaskSomedayCard';
import { Task } from '../../../../entities/Task';

jest.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key: string, fallback: string) => fallback }),
}));

const baseTask: Task = {
    name: 'Test task',
    status: 'not_started',
    completed_at: null,
};

describe('TaskSomedayCard', () => {
    it('renders toggle to active state when task is_someday=false', () => {
        render(
            <TaskSomedayCard
                task={{ ...baseTask, is_someday: false }}
                onToggle={jest.fn().mockResolvedValue(undefined)}
            />
        );
        const toggle = screen.getByTestId('task-someday-toggle');
        expect(toggle).toHaveAttribute('aria-pressed', 'false');
    });

    it('renders toggle to active state when task is_someday=true', () => {
        render(
            <TaskSomedayCard
                task={{ ...baseTask, is_someday: true }}
                onToggle={jest.fn().mockResolvedValue(undefined)}
            />
        );
        const toggle = screen.getByTestId('task-someday-toggle');
        expect(toggle).toHaveAttribute('aria-pressed', 'true');
    });

    it('clicking toggle calls onToggle with the negated value', () => {
        const onToggle = jest.fn().mockResolvedValue(undefined);
        render(
            <TaskSomedayCard
                task={{ ...baseTask, is_someday: false }}
                onToggle={onToggle}
            />
        );
        fireEvent.click(screen.getByTestId('task-someday-toggle'));
        expect(onToggle).toHaveBeenCalledWith(true);
    });

    it('clicking toggle when is_someday=true calls onToggle(false)', () => {
        const onToggle = jest.fn().mockResolvedValue(undefined);
        render(
            <TaskSomedayCard
                task={{ ...baseTask, is_someday: true }}
                onToggle={onToggle}
            />
        );
        fireEvent.click(screen.getByTestId('task-someday-toggle'));
        expect(onToggle).toHaveBeenCalledWith(false);
    });
});
