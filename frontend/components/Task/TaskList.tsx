import React from 'react';
import { ViewfinderCircleIcon } from '@heroicons/react/24/outline';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    type DragEndEvent,
} from '@dnd-kit/core';
import {
    SortableContext,
    sortableKeyboardCoordinates,
    useSortable,
    arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import TaskItem from './TaskItem';
import { Project } from '../../entities/Project';
import { Task } from '../../entities/Task';

interface TaskListProps {
    tasks: Task[];
    onTaskUpdate: (task: Task) => Promise<void>;
    onTaskCompletionToggle?: (task: Task) => void;
    onTaskCreate?: (task: Task) => void;
    onTaskDelete: (taskUid: string) => void;
    projects: Project[];
    hideProjectName?: boolean;
    onToggleToday?: (taskId: number, task?: Task) => Promise<void>;
    showCompletedTasks?: boolean;
    isInCompletedSection?: boolean;
    isUpcomingView?: boolean;
    showSuggestionChips?: boolean;
    // Plan 59: open this task in full-screen focus mode.
    onFocusTask?: (task: Task) => void;
    // Plan 61: enable drag-to-reorder. When set, rows become sortable and a
    // drag handle (⠿) is shown; the parent owns persistence via onReorder.
    enableDrag?: boolean;
    onReorder?: (reordered: Task[]) => void;
    selectable?: boolean;
    selectedUids?: Set<string>;
    onToggleSelect?: (uid: string) => void;
}

// Plan 61: wraps each row in a dnd-kit sortable. Listeners attach only to the
// drag handle (⠿) so they don't conflict with clicks on TaskItem buttons.
const SortableTaskRow: React.FC<{
    task: Task;
    children: React.ReactNode;
}> = ({ task, children }) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: task.uid! });
    const style: React.CSSProperties = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    };
    return (
        <div
            ref={setNodeRef}
            style={style}
            className="task-item-wrapper transition-all duration-200 ease-in-out overflow-visible relative hover:z-[10000] focus-within:z-[10000] group"
            data-testid={`task-item-${task.id}`}
        >
            <button
                {...attributes}
                {...listeners}
                className="absolute left-0 top-1/2 -translate-y-1/2 -ml-1 p-1 rounded text-gray-300 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity cursor-grab active:cursor-grabbing"
                aria-label="Drag to reorder"
                title="Drag to reorder"
            >
                <span className="text-lg leading-none select-none">⠿</span>
            </button>
            {children}
        </div>
    );
};

const TaskList: React.FC<TaskListProps> = ({
    tasks,
    onTaskUpdate,
    onTaskCompletionToggle,
    onTaskDelete,
    projects,
    hideProjectName = false,
    onToggleToday,
    showCompletedTasks = false,
    isInCompletedSection = false,
    isUpcomingView = false,
    showSuggestionChips = false,
    onFocusTask,
    enableDrag = false,
    onReorder,
    selectable = false,
    selectedUids = new Set(),
    onToggleSelect,
}) => {
    // Conditionally filter tasks based on showCompletedTasks prop
    const filteredTasks = showCompletedTasks
        ? tasks
        : tasks.filter((task) => {
              const isCompleted =
                  task.status === 'done' ||
                  task.status === 'archived' ||
                  task.status === 'cancelled' ||
                  task.status === 2 ||
                  task.status === 3 ||
                  task.status === 5;
              return !isCompleted;
          });

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (!over || active.id === over.id || !onReorder) return;
        const oldIndex = filteredTasks.findIndex((t) => t.uid === active.id);
        const newIndex = filteredTasks.findIndex((t) => t.uid === over.id);
        if (oldIndex === -1 || newIndex === -1) return;
        onReorder(arrayMove(filteredTasks, oldIndex, newIndex));
    };

    const renderRow = (task: Task, draggable: boolean) =>
        draggable ? (
            <SortableTaskRow key={task.id} task={task}>
                <div className="flex items-center w-full">
                    {selectable && (
                        <div className="flex-shrink-0 flex items-center pr-3 pl-1">
                            <input
                                type="checkbox"
                                checked={selectedUids.has(task.uid!)}
                                onChange={() => onToggleSelect?.(task.uid!)}
                                className="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 cursor-pointer"
                            />
                        </div>
                    )}
                    <div className="flex-1 min-w-0 relative">
                        <TaskItem
                            task={task}
                            onTaskUpdate={onTaskUpdate}
                            onTaskCompletionToggle={onTaskCompletionToggle}
                            onTaskDelete={onTaskDelete}
                            projects={projects}
                            hideProjectName={hideProjectName}
                            onToggleToday={onToggleToday}
                            isInCompletedSection={isInCompletedSection}
                            isUpcomingView={isUpcomingView}
                            showCompletedTasks={showCompletedTasks}
                            showSuggestionChips={showSuggestionChips}
                        />
                        {onFocusTask && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onFocusTask(task);
                                }}
                                className="absolute top-1 right-1 p-1 rounded text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-gray-700 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                                aria-label="Focus mode"
                                title="Focus mode"
                            >
                                <ViewfinderCircleIcon className="h-4 w-4" />
                            </button>
                        )}
                    </div>
                </div>
            </SortableTaskRow>
        ) : (
            <div
                key={task.id}
                className="task-item-wrapper transition-all duration-200 ease-in-out overflow-visible relative hover:z-[10000] focus-within:z-[10000] group flex items-center w-full"
                data-testid={`task-item-${task.id}`}
            >
                {selectable && (
                    <div className="flex-shrink-0 flex items-center pr-3 pl-1">
                        <input
                            type="checkbox"
                            checked={selectedUids.has(task.uid!)}
                            onChange={() => onToggleSelect?.(task.uid!)}
                            className="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 cursor-pointer"
                        />
                    </div>
                )}
                <div className="flex-1 min-w-0 relative">
                    <TaskItem
                        task={task}
                        onTaskUpdate={onTaskUpdate}
                        onTaskCompletionToggle={onTaskCompletionToggle}
                        onTaskDelete={onTaskDelete}
                        projects={projects}
                        hideProjectName={hideProjectName}
                        onToggleToday={onToggleToday}
                        isInCompletedSection={isInCompletedSection}
                        isUpcomingView={isUpcomingView}
                        showCompletedTasks={showCompletedTasks}
                        showSuggestionChips={showSuggestionChips}
                    />
                    {onFocusTask && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onFocusTask(task);
                            }}
                            className="absolute top-1 right-1 p-1 rounded text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-gray-700 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                            aria-label="Focus mode"
                            title="Focus mode"
                        >
                            <ViewfinderCircleIcon className="h-4 w-4" />
                        </button>
                    )}
                </div>
            </div>
        );

    const listContent =
        filteredTasks.length > 0 ? (
            filteredTasks.map((task) => renderRow(task, enableDrag))
        ) : (
            <p className="text-gray-500 dark:text-gray-400 text-center mt-4">
                No tasks available.
            </p>
        );

    if (enableDrag) {
        return (
            <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
            >
                <SortableContext
                    items={filteredTasks.map((t) => t.uid!)}
                >
                    <div className="task-list-container space-y-1.5 overflow-visible pl-5">
                        {listContent}
                    </div>
                </SortableContext>
            </DndContext>
        );
    }

    return (
        <div className="task-list-container space-y-1.5 overflow-visible">
            {listContent}
        </div>
    );
};

export default TaskList;
