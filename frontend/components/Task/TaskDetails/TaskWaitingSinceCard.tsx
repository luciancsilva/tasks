import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ClockIcon } from '@heroicons/react/24/outline';
import { Task } from '../../../entities/Task';

interface TaskWaitingSinceCardProps {
    task: Task;
    onAdjust: (date: Date | null) => Promise<void>;
}

function toDateInputValue(d: string | Date | null | undefined): string {
    if (!d) return '';
    const parsed = d instanceof Date ? d : new Date(d);
    if (Number.isNaN(parsed.getTime())) return '';
    return parsed.toISOString().slice(0, 10);
}

const TaskWaitingSinceCard: React.FC<TaskWaitingSinceCardProps> = ({
    task,
    onAdjust,
}) => {
    const { t } = useTranslation();
    const [value, setValue] = useState<string>(() =>
        toDateInputValue(task.waiting_since as any)
    );

    useEffect(() => {
        setValue(toDateInputValue(task.waiting_since as any));
    }, [task.waiting_since]);

    if (task.status !== 'waiting' && Number(task.status) !== 4) {
        return null;
    }

    const handleBlur = async () => {
        const currentISO = toDateInputValue(task.waiting_since as any);
        if (value === currentISO) return;
        const newDate = value ? new Date(value + 'T00:00:00.000Z') : null;
        await onAdjust(newDate);
    };

    const handleClear = async () => {
        setValue('');
        await onAdjust(null);
    };

    return (
        <div className="rounded-lg shadow-sm bg-white dark:bg-gray-900 border-2 border-gray-50 dark:border-gray-800 hover:border-gray-200 dark:hover:border-gray-700 transition-colors p-3">
            <div className="flex items-center gap-2 mb-2 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                <ClockIcon className="w-3.5 h-3.5" />
                {t('task.waitingSince', 'Waiting since')}
            </div>
            <div className="flex items-center gap-2">
                <input
                    type="date"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    onBlur={handleBlur}
                    data-testid="task-waiting-since-input"
                    className="flex-1 px-2 py-1 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded"
                />
                {value && (
                    <button
                        type="button"
                        onClick={handleClear}
                        data-testid="task-waiting-since-clear"
                        className="text-xs text-gray-500 dark:text-gray-400 hover:text-red-500 dark:hover:text-red-400"
                    >
                        {t('task.waitingSinceClear', 'Clear')}
                    </button>
                )}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                {t(
                    'task.waitingSinceHelp',
                    'Used to surface follow-up overdue in the Waiting view.'
                )}
            </p>
        </div>
    );
};

export default TaskWaitingSinceCard;
