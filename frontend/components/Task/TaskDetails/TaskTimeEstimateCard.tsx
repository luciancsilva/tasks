import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ClockIcon } from '@heroicons/react/24/outline';
import { Task } from '../../../entities/Task';

interface TaskTimeEstimateCardProps {
    task: Task;
    onChange: (minutes: number | null) => Promise<void>;
}

const PRESETS = [5, 15, 30, 60, 120];

const TaskTimeEstimateCard: React.FC<TaskTimeEstimateCardProps> = ({
    task,
    onChange,
}) => {
    const { t } = useTranslation();
    const [value, setValue] = useState<string>(
        task.time_estimate != null ? String(task.time_estimate) : ''
    );

    // Keep the local input in sync when the task changes underneath us.
    useEffect(() => {
        setValue(task.time_estimate != null ? String(task.time_estimate) : '');
    }, [task.time_estimate]);

    const commit = (raw: string) => {
        if (raw.trim() === '') {
            onChange(null);
            return;
        }
        const n = Number(raw);
        // Clamp to the model's validated range (1-1440); ignore junk.
        if (!Number.isFinite(n) || n < 1) return;
        onChange(Math.min(Math.round(n), 1440));
    };

    return (
        <div className="rounded-lg shadow-sm bg-white dark:bg-gray-900 border-2 border-gray-50 dark:border-gray-800 hover:border-gray-200 dark:hover:border-gray-700 transition-colors p-3">
            <div className="flex items-center gap-2 mb-2 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                <ClockIcon className="w-3.5 h-3.5" />
                {t('task.timeEstimate', 'Time estimate')}
            </div>
            <div className="flex items-center gap-2">
                <input
                    type="number"
                    min={1}
                    max={1440}
                    value={value}
                    placeholder={t('task.timeEstimatePlaceholder', 'minutes')}
                    onChange={(e) => setValue(e.target.value)}
                    onBlur={(e) => commit(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') commit((e.target as HTMLInputElement).value);
                    }}
                    className="w-24 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1.5 text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <span className="text-xs text-gray-400">
                    {t('task.timeEstimateUnit', 'min')}
                </span>
            </div>
            <div className="flex flex-wrap gap-1.5 mt-2">
                {PRESETS.map((p) => (
                    <button
                        key={p}
                        type="button"
                        onClick={() => {
                            setValue(String(p));
                            onChange(p);
                        }}
                        className={`px-2 py-0.5 text-xs rounded-md border transition-colors ${
                            task.time_estimate === p
                                ? 'bg-blue-600 text-white border-blue-600'
                                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-blue-400'
                        }`}
                    >
                        {p}
                    </button>
                ))}
                {task.time_estimate != null && (
                    <button
                        type="button"
                        onClick={() => {
                            setValue('');
                            onChange(null);
                        }}
                        className="px-2 py-0.5 text-xs rounded-md border border-gray-200 dark:border-gray-700 text-gray-500 hover:text-red-500"
                    >
                        {t('common.clear', 'Clear')}
                    </button>
                )}
            </div>
        </div>
    );
};

export default TaskTimeEstimateCard;
