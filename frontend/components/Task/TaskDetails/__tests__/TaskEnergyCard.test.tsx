import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import TaskEnergyCard from '../TaskEnergyCard';
import { Task } from '../../../../entities/Task';

jest.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (_key: string, fallback: string) => fallback }),
}));

const baseTask = { energy: null } as Task;

describe('TaskEnergyCard - select interaction', () => {
    it('renders the energy select', () => {
        render(<TaskEnergyCard task={baseTask} onChange={jest.fn()} />);
        expect(screen.getByRole('combobox')).toBeInTheDocument();
    });

    it('selecting a value calls onChange with that energy name', () => {
        const onChange = jest.fn().mockResolvedValue(undefined);
        render(<TaskEnergyCard task={baseTask} onChange={onChange} />);

        fireEvent.change(screen.getByRole('combobox'), {
            target: { value: 'high' },
        });

        expect(onChange).toHaveBeenCalledTimes(1);
        expect(onChange).toHaveBeenCalledWith('high');
    });

    it('selecting the empty option calls onChange with null (clears)', () => {
        const onChange = jest.fn().mockResolvedValue(undefined);
        const task = { energy: 2 } as Task;
        render(<TaskEnergyCard task={task} onChange={onChange} />);

        fireEvent.change(screen.getByRole('combobox'), {
            target: { value: '' },
        });

        expect(onChange).toHaveBeenCalledWith(null);
    });

    it('reflects the current energy value as the selected option', () => {
        const task = { energy: 1 } as Task;
        render(<TaskEnergyCard task={task} onChange={jest.fn()} />);

        const select = screen.getByRole('combobox') as HTMLSelectElement;
        expect(select.value).toBe('medium');
    });
});
