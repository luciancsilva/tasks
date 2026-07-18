import React from 'react';
import { useTranslation } from 'react-i18next';
import { SparklesIcon } from '@heroicons/react/24/outline';
import { Task } from '../../../entities/Task';

interface TaskSomedayCardProps {
    task: Task;
    onToggle: (value: boolean) => Promise<void>;
}

const TaskSomedayCard: React.FC<TaskSomedayCardProps> = ({
    task,
    onToggle,
}) => {
    const { t } = useTranslation();

    return (
        <div className="rounded-lg shadow-sm bg-white dark:bg-gray-900 border-2 border-gray-50 dark:border-gray-800 hover:border-gray-200 dark:hover:border-gray-700 transition-colors p-3">
            <div className="flex items-center gap-2 mb-2 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                <SparklesIcon className="w-3.5 h-3.5" />
                {t('task.someday', 'Someday/Maybe')}
            </div>
            <div className="flex items-center justify-between">
                <p className="text-xs text-gray-500 dark:text-gray-400">
                    {task.is_someday
                        ? t(
                              'task.somedayActive',
                              'Hidden from action lists. Review periodically.'
                          )
                        : t(
                              'task.somedayInactive',
                              'Mark to defer this task out of action lists.'
                          )}
                </p>
                <button
                    type="button"
                    onClick={() => onToggle(!task.is_someday)}
                    data-testid="task-someday-toggle"
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 ml-2 ${
                        task.is_someday ? 'bg-blue-600' : 'bg-gray-300'
                    }`}
                    aria-pressed={task.is_someday}
                    aria-label={t('task.somedayToggleAria', 'Toggle Someday')}
                >
                    <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                            task.is_someday
                                ? 'translate-x-6'
                                : 'translate-x-1'
                        }`}
                    />
                </button>
            </div>
        </div>
    );
};

export default TaskSomedayCard;
