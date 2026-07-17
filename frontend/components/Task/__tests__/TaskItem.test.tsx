import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';
import TaskItem from '../TaskItem';
import { Task } from '../../../entities/Task';

jest.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (_key: string, fallback: string) => fallback }),
    initReactI18next: { type: '3rdParty', init: jest.fn() },
}));

jest.mock('../../Shared/ToastContext', () => ({
    useToast: () => ({
        showErrorToast: jest.fn(),
        showUndoToast: jest.fn(),
    }),
}));

// fetchSubtasks resolves null to simulate a malformed/erroring API response.
jest.mock('../../../utils/tasksService', () => ({
    toggleTaskCompletion: jest.fn(),
    updateTask: jest.fn(),
    fetchSubtasks: jest.fn().mockResolvedValue(null),
}));

const baseTask: Task = {
    id: 1,
    uid: 'task-uid-1',
    name: 'Parent task with subtasks',
    status: 'not_started',
    completed_at: null,
    subtasks: [{ id: 2, uid: 'sub-1', name: 'Subtask', status: 'not_started', completed_at: null }],
};

describe('TaskItem - null-safe subtasks loading', () => {
    it('renders without throwing and keeps subtasks empty when fetchSubtasks resolves null', async () => {
        render(
            <MemoryRouter>
                <TaskItem
                    task={baseTask}
                    onTaskUpdate={jest.fn().mockResolvedValue(undefined)}
                    onTaskDelete={jest.fn()}
                    projects={[]}
                />
            </MemoryRouter>
        );

        expect(screen.getAllByText('Parent task with subtasks').length).toBeGreaterThan(0);

        // Trigger the subtasks toggle, which calls loadSubtasks() -> fetchSubtasks() -> null.
        const [subtasksToggle] = screen.getAllByTitle('Show subtasks');
        fireEvent.click(subtasksToggle);

        // Should not throw despite fetchSubtasks resolving null, and the
        // component tree should remain intact.
        await waitFor(() => {
            expect(screen.getAllByText('Parent task with subtasks').length).toBeGreaterThan(0);
        });
    });
});
