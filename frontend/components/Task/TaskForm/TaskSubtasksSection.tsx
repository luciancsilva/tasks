import React, { useState, useRef } from 'react';
import { PlusIcon } from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent,
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';

import { Task } from '../../../entities/Task';
import { toggleTaskCompletion, reorderSubtasks } from '../../../utils/tasksService';
import SortableSubtaskItem from './SortableSubtaskItem';

interface TaskSubtasksSectionProps {
    parentTaskId: number;
    parentTaskUid?: string;
    subtasks: Task[];
    onSubtasksChange: (subtasks: Task[]) => void;
    onSubtaskUpdate?: (subtask: Task) => Promise<void>;
    onSave?: (subtasks: Task[]) => void;
}

const TaskSubtasksSection: React.FC<TaskSubtasksSectionProps> = ({
    parentTaskId,
    parentTaskUid,
    subtasks,
    onSubtasksChange,
    onSubtaskUpdate,
    onSave,
}) => {
    const [newSubtaskName, setNewSubtaskName] = useState('');
    const [isLoading] = useState(false);
    const [editingIndex, setEditingIndex] = useState<number | null>(null);
    const [editingName, setEditingName] = useState('');
    const { t } = useTranslation();
    const subtasksSectionRef = useRef<HTMLDivElement>(null);
    const addInputRef = useRef<HTMLInputElement>(null);

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: { delay: 100, tolerance: 5 },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;
        if (over && active.id !== over.id) {
            const oldIndex = subtasks.findIndex((s, i) => (s.uid || `new-${i}`) === active.id);
            const newIndex = subtasks.findIndex((s, i) => (s.uid || `new-${i}`) === over.id);

            if (oldIndex !== -1 && newIndex !== -1) {
                const updatedSubtasks = arrayMove(subtasks, oldIndex, newIndex);
                onSubtasksChange(updatedSubtasks);

                // Subtasks not yet persisted have no uid, so filtering on uid
                // alone already excludes them.
                const validUids = updatedSubtasks
                    .filter((s) => s.uid)
                    .map((s) => s.uid!);
                if (validUids.length > 0 && parentTaskUid) {
                    try {
                        await reorderSubtasks(parentTaskUid, validUids);
                    } catch (error) {
                        console.error('Error reordering subtasks in background:', error);
                        // Revert optimistic update could be implemented here
                    }
                }
            }
        }
    };

    const scrollToBottom = () => {
        setTimeout(() => {
            const modalScrollContainer = document.querySelector(
                '.absolute.inset-0.overflow-y-auto'
            );
            if (modalScrollContainer) {
                modalScrollContainer.scrollTo({
                    top: modalScrollContainer.scrollHeight,
                    behavior: 'smooth',
                });
            }
        }, 100);
    };

    const handleCreateSubtask = () => {
        if (!newSubtaskName.trim()) return;

        const newSubtask: Task = {
            name: newSubtaskName.trim(),
            status: 'not_started',
            priority: 'low',
            today: false,
            parent_task_id: parentTaskId,
            isNew: true,
            _isNew: true,
            completed_at: null,
        } as Task;

        const updatedSubtasks = [...subtasks, newSubtask];
        onSubtasksChange(updatedSubtasks);
        setNewSubtaskName('');
        scrollToBottom();

        onSave?.(updatedSubtasks);
    };

    const handleDeleteSubtask = (index: number) => {
        const updatedSubtasks = subtasks.filter((_, i) => i !== index);
        onSubtasksChange(updatedSubtasks);
        onSave?.(updatedSubtasks);
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleCreateSubtask();
        }
    };

    const handleEditSubtask = (index: number) => {
        setEditingIndex(index);
        setEditingName(subtasks[index].name);
    };

    const handleSaveEdit = () => {
        if (!editingName.trim() || editingIndex === null) return;

        const updatedSubtasks = subtasks.map((subtask, index) => {
            if (index === editingIndex) {
                const isNameChanged = subtask.name !== editingName.trim();
                const isNew =
                    (subtask as any)._isNew || (subtask as any).isNew || false;
                const isEdited = !isNew && isNameChanged;
                return {
                    ...subtask,
                    name: editingName.trim(),
                    isNew: isNew,
                    isEdited: isEdited,
                    _isNew: isNew,
                    _isEdited: isEdited,
                };
            }
            return subtask;
        });

        onSubtasksChange(updatedSubtasks);
        setEditingIndex(null);
        setEditingName('');
        onSave?.(updatedSubtasks);
    };

    const handleCancelEdit = () => {
        setEditingIndex(null);
        setEditingName('');
    };

    const handleToggleNewSubtaskCompletion = (index: number) => {
        const updatedSubtasks = subtasks.map((subtask, i) => {
            if (i === index) {
                const isDone =
                    subtask.status === 'done' || subtask.status === 2;
                const newStatus = isDone
                    ? ('not_started' as const)
                    : ('done' as const);
                const hasId =
                    subtask.id &&
                    !((subtask as any)._isNew || (subtask as any).isNew);

                return {
                    ...subtask,
                    status: newStatus,
                    completed_at: isDone ? null : new Date().toISOString(),
                    _statusChanged: hasId,
                };
            }
            return subtask;
        });
        onSubtasksChange(updatedSubtasks);
    };

    const handleToggleSubtaskCompletion = async (subtask: Task, index: number) => {
        const isPersisted = subtask.id && subtask.uid &&
            !((subtask as any)._isNew || (subtask as any).isNew);

        if (isPersisted) {
            try {
                const updatedSubtask = await toggleTaskCompletion(subtask.uid!);
                if (onSubtaskUpdate) {
                    await onSubtaskUpdate(updatedSubtask);
                } else {
                    const updatedSubtasks = subtasks.map((s, i) =>
                        i === index ? updatedSubtask : s
                    );
                    onSubtasksChange(updatedSubtasks);
                }
            } catch (error) {
                console.error('Error toggling subtask completion:', error);
            }
        } else {
            handleToggleNewSubtaskCompletion(index);
        }
    };

    return (
        <div ref={subtasksSectionRef} className="space-y-3">
            {isLoading ? (
                <div className="text-sm text-gray-500 dark:text-gray-400">
                    {t('loading.subtasks', 'Loading subtasks...')}
                </div>
            ) : subtasks.length > 0 ? (
                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                    modifiers={[restrictToVerticalAxis]}
                >
                    <SortableContext
                        items={subtasks.map((s, i) => s.uid || `new-${i}`)}
                        strategy={verticalListSortingStrategy}
                    >
                        <div className="space-y-1">
                            {subtasks.map((subtask, index) => (
                                <SortableSubtaskItem
                                    key={subtask.uid || `new-${index}`}
                                    subtask={subtask}
                                    index={index}
                                    editingIndex={editingIndex}
                                    editingName={editingName}
                                    onEdit={handleEditSubtask}
                                    onDelete={handleDeleteSubtask}
                                    onToggleCompletion={handleToggleSubtaskCompletion}
                                    onEditingNameChange={setEditingName}
                                    onSaveEdit={handleSaveEdit}
                                    onCancelEdit={handleCancelEdit}
                                />
                            ))}
                        </div>
                    </SortableContext>
                </DndContext>
            ) : (
                <div className="text-sm text-gray-500 dark:text-gray-400">
                    {t('subtasks.noSubtasks', 'No subtasks yet')}
                </div>
            )}

            <div className="flex items-center space-x-2">
                <input
                    ref={addInputRef}
                    type="text"
                    value={newSubtaskName}
                    onChange={(e) => setNewSubtaskName(e.target.value)}
                    onKeyDown={handleKeyPress}
                    placeholder={t('subtasks.placeholder', 'Add a subtask...')}
                    className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white overflow-hidden"
                />
                <button
                    type="button"
                    onClick={handleCreateSubtask}
                    disabled={!newSubtaskName.trim()}
                    className="p-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                    title={t('actions.add', 'Add')}
                >
                    <PlusIcon className="h-4 w-4" />
                </button>
            </div>
        </div>
    );
};

export default TaskSubtasksSection;
