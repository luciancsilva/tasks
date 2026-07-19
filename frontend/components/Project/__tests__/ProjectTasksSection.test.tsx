import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import ProjectTasksSection from '../ProjectTasksSection';
import { Task } from '../../../entities/Task';
import { Project } from '../../../entities/Project';

jest.mock('../AutoSuggestNextActionBox', () => () => null);
jest.mock('../../Task/NewTask', () => () => null);
jest.mock('../../Task/TaskList', () => () => null);

const t = (key: string, fallback?: string) => fallback || key;

const baseProps = {
    showAutoSuggestForm: false,
    onAddNextAction: jest.fn(),
    onDismissNextAction: jest.fn(),
    onTaskCreate: jest.fn(),
    onTaskUpdate: jest.fn(),
    onTaskCompletionToggle: jest.fn(),
    onTaskDelete: jest.fn(),
    onToggleToday: jest.fn(),
    allProjects: [],
    showCompleted: false,
    taskSearchQuery: '',
    t: t as any,
};

const sequentialProject: Project = {
    name: 'Sequential proj',
    execution_mode: 'sequential',
};

const parallelProject: Project = {
    name: 'Parallel proj',
    execution_mode: 'parallel',
};

const t1: Task = {
    name: 'Task A',
    status: 6,
    order: 1,
    completed_at: null,
};
const t2: Task = {
    name: 'Task B',
    status: 6,
    order: 2,
    completed_at: null,
};
const doneT1: Task = {
    name: 'Task A',
    status: 2,
    order: 1,
    completed_at: null,
};

describe('ProjectTasksSection — next action callout (plan 53b)', () => {
    it('shows the next action callout for the first not-done task of a sequential project', () => {
        render(
            <ProjectTasksSection
                {...baseProps}
                project={sequentialProject}
                displayTasks={[t1, t2]}
            />
        );

        const callout = screen.getByTestId('project-next-action-callout');
        expect(callout.textContent).toContain('Task A');
        expect(callout.textContent).not.toContain('Task B');
    });

    it('advances the callout to the next task once the first is done', () => {
        render(
            <ProjectTasksSection
                {...baseProps}
                project={sequentialProject}
                displayTasks={[doneT1, t2]}
            />
        );

        const callout = screen.getByTestId('project-next-action-callout');
        expect(callout.textContent).toContain('Task B');
    });

    it('does not render the callout for a parallel project', () => {
        render(
            <ProjectTasksSection
                {...baseProps}
                project={parallelProject}
                displayTasks={[t1, t2]}
            />
        );

        expect(
            screen.queryByTestId('project-next-action-callout')
        ).not.toBeInTheDocument();
    });

    it('does not render the callout when there is no project', () => {
        render(
            <ProjectTasksSection
                {...baseProps}
                project={null}
                displayTasks={[t1, t2]}
            />
        );

        expect(
            screen.queryByTestId('project-next-action-callout')
        ).not.toBeInTheDocument();
    });
});
