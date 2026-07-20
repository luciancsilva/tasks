import React from 'react';
import { useTranslation } from 'react-i18next';
import { TrashIcon, CheckIcon, ServerStackIcon } from '@heroicons/react/24/outline';

interface InboxBulkToolbarProps {
    selectedUids: Set<string>;
    onClear: () => void;
    onProcessAllAsTasks: (shared: { sharedTags?: string[]; sharedProjectUid?: string; sharedAreaUid?: string }) => Promise<void>;
    onDeleteAll: () => Promise<void>;
    onMarkAllProcessed: () => Promise<void>;
}

const InboxBulkToolbar: React.FC<InboxBulkToolbarProps> = ({
    selectedUids,
    onProcessAllAsTasks,
    onDeleteAll,
    onMarkAllProcessed,
}) => {
    const { t } = useTranslation();
    const count = selectedUids.size;

    if (count === 0) return null;

    const handleDelete = () => {
        if (window.confirm(t('inbox.bulkConfirmDelete', { count, defaultValue: `Delete ${count} items?` }))) {
            onDeleteAll();
        }
    };

    const handleProcess = () => {
        // V1: just create tasks without shared properties
        onProcessAllAsTasks({});
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
                onClick={handleProcess}
                className="flex items-center text-sm text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 font-medium"
            >
                <ServerStackIcon className="h-5 w-5 mr-1" />
                <span className="hidden sm:inline">
                    {t('inbox.bulkProcessAllAsTask', 'Process all as Task')}
                </span>
            </button>

            <button
                onClick={onMarkAllProcessed}
                className="flex items-center text-sm text-gray-700 dark:text-gray-300 hover:text-green-600 dark:hover:text-green-400 font-medium"
            >
                <CheckIcon className="h-5 w-5 mr-1" />
                <span className="hidden sm:inline">
                    {t('inbox.bulkMarkAllProcessed', 'Mark all processed')}
                </span>
            </button>

            <button
                onClick={handleDelete}
                className="flex items-center text-sm text-gray-700 dark:text-gray-300 hover:text-red-600 dark:hover:text-red-400 font-medium"
            >
                <TrashIcon className="h-5 w-5 mr-1" />
                <span className="hidden sm:inline">
                    {t('inbox.bulkDeleteAll', 'Delete all')}
                </span>
            </button>
        </div>
    );
};

export default InboxBulkToolbar;
