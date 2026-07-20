import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Bars3Icon, TrashIcon } from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';
import { Task } from '../../../entities/Task';
import TaskPriorityIcon from '../../Shared/Icons/TaskPriorityIcon';

interface SortableSubtaskItemProps {
    subtask: Task;
    index: number;
    editingIndex: number | null;
    editingName: string;
    onEdit: (index: number) => void;
    onDelete: (index: number) => void;
    onToggleCompletion: (subtask: Task, index: number) => void;
    onEditingNameChange: (val: string) => void;
    onSaveEdit: () => void;
    onCancelEdit: () => void;
}

const SortableSubtaskItem: React.FC<SortableSubtaskItemProps> = ({
    subtask,
    index,
    editingIndex,
    editingName,
    onEdit,
    onDelete,
    onToggleCompletion,
    onEditingNameChange,
    onSaveEdit,
    onCancelEdit,
}) => {
    const { t } = useTranslation();
    const id = subtask.uid || `new-${index}`;
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        position: 'relative' as const,
        zIndex: isDragging ? 1 : 0,
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className="rounded-lg shadow-sm bg-white dark:bg-gray-900 border-2 border-gray-50 dark:border-gray-800 flex"
        >
            <div
                {...attributes}
                {...listeners}
                className="flex items-center justify-center pl-2 pr-1 cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 touch-none"
            >
                <Bars3Icon className="h-4 w-4" />
            </div>
            <div className="flex-1 overflow-hidden min-w-0">
                {editingIndex === index ? (
                    <div className="pr-3 py-2.5 flex items-center space-x-3 overflow-hidden">
                        <div className="flex-shrink-0">
                            <TaskPriorityIcon
                                priority={subtask.priority || 'low'}
                                status={subtask.status || 'not_started'}
                                onToggleCompletion={() => onToggleCompletion(subtask, index)}
                            />
                        </div>
                        <input
                            type="text"
                            value={editingName}
                            onChange={(e) => onEditingNameChange(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    e.preventDefault();
                                    onSaveEdit();
                                } else if (e.key === 'Escape') {
                                    onCancelEdit();
                                }
                            }}
                            onBlur={onSaveEdit}
                            className="flex-1 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-600 dark:text-white overflow-hidden"
                            autoFocus
                        />
                        <button
                            type="button"
                            onClick={onCancelEdit}
                            className="p-1 text-gray-500 hover:text-gray-700 dark:hover:text-gray-400"
                            title={t('actions.cancel', 'Cancel')}
                        >
                            ×
                        </button>
                    </div>
                ) : (
                    <div className="pr-3 py-2.5 flex items-center justify-between overflow-hidden">
                        <div className="flex items-center space-x-3 flex-1 min-w-0 overflow-hidden">
                            <div className="flex-shrink-0">
                                <TaskPriorityIcon
                                    priority={subtask.priority || 'low'}
                                    status={subtask.status || 'not_started'}
                                    onToggleCompletion={() => onToggleCompletion(subtask, index)}
                                />
                            </div>
                            <span
                                className={`text-sm flex-1 cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 break-all ${
                                    subtask.status === 'done' ||
                                    subtask.status === 2 ||
                                    subtask.status === 'archived' ||
                                    subtask.status === 3
                                        ? 'text-gray-500 dark:text-gray-400'
                                        : 'text-gray-900 dark:text-gray-100'
                                }`}
                                onClick={() => onEdit(index)}
                                title={t('actions.clickToEdit', 'Click to edit')}
                            >
                                {subtask.name}
                            </span>
                        </div>
                        <button
                            type="button"
                            onClick={() => onDelete(index)}
                            className="p-1 text-red-500 hover:text-red-700 dark:hover:text-red-400"
                            title={t('actions.delete', 'Delete')}
                        >
                            <TrashIcon className="h-4 w-4" />
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default SortableSubtaskItem;
