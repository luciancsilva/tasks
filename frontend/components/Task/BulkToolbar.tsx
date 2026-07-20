import React from 'react';
import { useTranslation } from 'react-i18next';
import { Task } from '../../entities/Task';
import { CheckIcon, TrashIcon, XMarkIcon } from '@heroicons/react/24/outline';

interface BulkToolbarProps {
    selectedUids: Set<string>;
    onClear: () => void;
    onBulkDelete: () => Promise<void>;
    onBulkComplete: () => Promise<void>;
}

const BulkToolbar: React.FC<BulkToolbarProps> = ({
    selectedUids,
    onClear,
    onBulkDelete,
    onBulkComplete,
}) => {
    const { t } = useTranslation();
    const count = selectedUids.size;

    if (count === 0) return null;

    const handleDelete = () => {
        if (window.confirm(t('bulk.confirmDelete', { count, defaultValue: `Delete ${count} tasks?` }))) {
            onBulkDelete();
        }
    };

    return (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-white dark:bg-gray-800 shadow-xl rounded-full border border-gray-200 dark:border-gray-700 px-6 py-3 flex items-center space-x-4 z-50 transition-all">
            <div className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300">
                <span className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 py-0.5 px-2 rounded-full mr-2">
                    {count}
                </span>
                {t('bulk.selected', 'selected')}
            </div>

            <div className="h-6 border-l border-gray-300 dark:border-gray-600"></div>

            <button
                onClick={onBulkComplete}
                className="flex items-center text-sm text-gray-600 hover:text-green-600 dark:text-gray-400 dark:hover:text-green-400 transition-colors"
                title={t('bulk.markComplete', 'Mark Complete')}
            >
                <CheckIcon className="h-5 w-5 mr-1" />
                <span className="hidden sm:inline">{t('actions.complete', 'Complete')}</span>
            </button>

            <button
                onClick={handleDelete}
                className="flex items-center text-sm text-gray-600 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 transition-colors"
                title={t('bulk.delete', 'Delete')}
            >
                <TrashIcon className="h-5 w-5 mr-1" />
                <span className="hidden sm:inline">{t('actions.delete', 'Delete')}</span>
            </button>

            <div className="h-6 border-l border-gray-300 dark:border-gray-600"></div>

            <button
                onClick={onClear}
                className="p-1 rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300 transition-colors"
                title={t('bulk.clearSelection', 'Clear selection')}
            >
                <XMarkIcon className="h-5 w-5" />
            </button>
        </div>
    );
};

export default BulkToolbar;
