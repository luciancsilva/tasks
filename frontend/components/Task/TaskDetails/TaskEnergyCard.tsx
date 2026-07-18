import React from 'react';
import { useTranslation } from 'react-i18next';
import { BoltIcon } from '@heroicons/react/24/outline';
import { Task } from '../../../entities/Task';

type EnergyName = 'low' | 'medium' | 'high';

interface TaskEnergyCardProps {
    task: Task;
    onChange: (energy: EnergyName | null) => Promise<void>;
}

const TaskEnergyCard: React.FC<TaskEnergyCardProps> = ({ task, onChange }) => {
    const { t } = useTranslation();

    const valueToName = (value: number | null | undefined): EnergyName | '' => {
        if (value === 0) return 'low';
        if (value === 1) return 'medium';
        if (value === 2) return 'high';
        return '';
    };

    const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const next = e.target.value;
        onChange(next === '' ? null : (next as EnergyName));
    };

    return (
        <div className="rounded-lg shadow-sm bg-white dark:bg-gray-900 border-2 border-gray-50 dark:border-gray-800 hover:border-gray-200 dark:hover:border-gray-700 transition-colors p-3">
            <div className="flex items-center gap-2 mb-2 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                <BoltIcon className="w-3.5 h-3.5" />
                {t('task.energy', 'Energy')}
            </div>
            <select
                value={valueToName(task.energy)}
                onChange={handleChange}
                className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1.5 text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
                <option value="">
                    {t('task.energyNone', 'No energy level')}
                </option>
                <option value="low">
                    {t('task.energyLow', 'Low')}
                </option>
                <option value="medium">
                    {t('task.energyMedium', 'Medium')}
                </option>
                <option value="high">
                    {t('task.energyHigh', 'High')}
                </option>
            </select>
        </div>
    );
};

export default TaskEnergyCard;
