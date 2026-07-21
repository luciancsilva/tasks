import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import ProjectModal from '../ProjectModal';

jest.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, fallback?: string) => fallback || key,
    }),
}));

jest.mock('../../Shared/ToastContext', () => ({
    useToast: () => ({
        showSuccessToast: jest.fn(),
        showErrorToast: jest.fn(),
    }),
}));

jest.mock('../../../store/useStore', () => ({
    useStore: () => ({
        tagsStore: {
            tags: [],
            hasLoaded: true,
            isLoading: false,
            loadTags: jest.fn(),
            addNewTags: jest.fn(),
        },
    }),
}));

jest.mock('../../../utils/goalsService', () => ({
    fetchGoals: jest.fn().mockResolvedValue([]),
}));

// Heavy subcomponents unrelated to execution_mode — stubbed to keep this
// test focused and independent of their own internals/data fetching.
jest.mock('../../Tag/TagInput', () => () => null);
jest.mock('../../Shared/PriorityDropdown', () => () => null);
jest.mock('../../Shared/AreaDropdown', () => () => null);
jest.mock('../../Shared/DatePicker', () => () => null);
jest.mock('../../Shared/ProjectStateDropdown', () => () => null);
jest.mock('../../Shared/ColorPicker', () => () => null);
jest.mock('../../Shared/GoalDropdown', () => () => null);

describe('ProjectModal — execution mode (plan 53b)', () => {
    const noop = () => {};

    it('renders parallel/sequential toggle when the section is opened', () => {
        const onSave = jest.fn().mockResolvedValue(undefined);
        render(
            <ProjectModal isOpen={true} onClose={noop} onSave={onSave} areas={[]} />
        );

        fireEvent.click(screen.getByTitle('Execution mode'));
        expect(screen.getByText('Parallel')).toBeInTheDocument();
        expect(screen.getByText('Sequential')).toBeInTheDocument();
    });

    it('toggling to sequential and saving includes execution_mode=sequential in payload', async () => {
        const onSave = jest.fn().mockResolvedValue(undefined);
        render(
            <ProjectModal isOpen={true} onClose={noop} onSave={onSave} areas={[]} />
        );

        const nameInput = document.querySelector(
            'input[type="text"], textarea'
        ) as HTMLInputElement;
        fireEvent.change(nameInput, { target: { value: 'Test project' } });

        fireEvent.click(screen.getByTitle('Execution mode'));
        fireEvent.click(screen.getByText('Sequential'));

        const saveButton = screen.getByTestId('project-save-button');
        fireEvent.click(saveButton);

        await new Promise((resolve) => setTimeout(resolve, 0));

        expect(onSave).toHaveBeenCalledWith(
            expect.objectContaining({ execution_mode: 'sequential' }),
            expect.any(String)
        );
    });
});
