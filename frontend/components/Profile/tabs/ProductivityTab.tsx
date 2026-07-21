import React from 'react';
import { useTranslation } from 'react-i18next';
import { ClockIcon } from '@heroicons/react/24/outline';

import type { ProfileFormData } from '../types';

interface ProductivityTabProps {
    isActive: boolean;
    pomodoroEnabled: boolean;
    onTogglePomodoro: () => void;
    formData: ProfileFormData;
    onChangeField: (field: keyof ProfileFormData, value: any) => void;
}

const ProductivityTab: React.FC<ProductivityTabProps> = ({
    isActive,
    pomodoroEnabled,
    onTogglePomodoro,
    formData,
    onChangeField,
}) => {
    const { t } = useTranslation();

    if (!isActive) return null;

    return (
        <div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-6 flex items-center">
                <ClockIcon className="w-6 h-6 mr-3 text-green-500" />
                {t('profile.productivityFeatures', 'Productivity Features')}
            </h3>

            <div className="space-y-6">
                <div className="flex items-center justify-between py-4 border-b border-gray-200 dark:border-gray-700">
                    <div>
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            {t(
                                'profile.enablePomodoro',
                                'Enable Pomodoro Timer'
                            )}
                        </label>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            {t(
                                'profile.pomodoroDescription',
                                'Enable the Pomodoro timer in the navigation bar for focused work sessions.'
                            )}
                        </p>
                    </div>
                    <div
                        className={`relative inline-block w-12 h-6 transition-colors duration-200 ease-in-out rounded-full cursor-pointer ${
                            pomodoroEnabled
                                ? 'bg-blue-500'
                                : 'bg-gray-300 dark:bg-gray-600'
                        }`}
                        onClick={onTogglePomodoro}
                    >
                        <span
                            className={`absolute left-0 top-0 bottom-0 m-1 w-4 h-4 transition-transform duration-200 ease-in-out transform bg-white rounded-full ${
                                pomodoroEnabled
                                    ? 'translate-x-6'
                                    : 'translate-x-0'
                            }`}
                        ></span>
                    </div>
                </div>
                <div className="flex items-center justify-between py-4 border-b border-gray-200 dark:border-gray-700">
                    <div>
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            {t('profile.staleTaskDays', 'Stale task threshold (days)')}
                        </label>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            {t('profile.staleTaskDaysDesc', 'Number of days before an inactive task is considered stale.')}
                        </p>
                    </div>
                    <div>
                        <input
                            type="number"
                            min="1"
                            max="365"
                            value={formData.stale_task_days || 30}
                            onChange={(e) => onChangeField('stale_task_days', parseInt(e.target.value, 10))}
                            className="block w-24 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                        />
                    </div>
                </div>

                <div className="flex items-center justify-between py-4 border-b border-gray-200 dark:border-gray-700">
                    <div>
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            {t('profile.inboxStaleHours', 'Inbox stale threshold (hours)')}
                        </label>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            {t('profile.inboxStaleHoursDesc', 'Number of hours before an unprocessed inbox item is considered stale.')}
                        </p>
                    </div>
                    <div>
                        <input
                            type="number"
                            min="1"
                            max="720"
                            value={formData.inbox_stale_hours || 48}
                            onChange={(e) => onChangeField('inbox_stale_hours', parseInt(e.target.value, 10))}
                            className="block w-24 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ProductivityTab;
