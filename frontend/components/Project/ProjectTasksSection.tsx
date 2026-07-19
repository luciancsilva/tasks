import React, { useMemo } from 'react';
import { Project } from '../../entities/Project';
import { Task } from '../../entities/Task';
import AutoSuggestNextActionBox from './AutoSuggestNextActionBox';
import NewTask from '../Task/NewTask';
import TaskList from '../Task/TaskList';
import { TFunction } from 'i18next';
import { QueueListIcon } from '@heroicons/react/24/outline';

// Backend statuses that mean "not actionable": done(2), archived(3), cancelled(5).
const NON_ACTIONABLE_STATUSES = [2, 3, 5, 'done', 'archived', 'cancelled'];

interface ProjectTasksSectionProps {
    project: Project | null;
    displayTasks: Task[];
    showAutoSuggestForm: boolean;
    onAddNextAction: (projectUid: string, description: string) => void;
    onDismissNextAction: () => void;
    onTaskCreate: (taskName: string) => Promise<void>;
    onTaskUpdate: (task: Task) => Promise<void>;
    onTaskCompletionToggle: (task: Task) => void;
    onTaskDelete: (taskUid: string) => void;
    onToggleToday: (taskId: number, task?: Task) => Promise<void>;
    allProjects: Project[];
    showCompleted: boolean;
    taskSearchQuery: string;
    t: TFunction;
}

const ProjectTasksSection: React.FC<ProjectTasksSectionProps> = ({
    project,
    displayTasks,
    showAutoSuggestForm,
    onAddNextAction,
    onDismissNextAction,
    onTaskCreate,
    onTaskUpdate,
    onTaskCompletionToggle,
    onTaskDelete,
    onToggleToday,
    allProjects,
    showCompleted,
    taskSearchQuery,
    t,
}) => {
    // Plan 53a already hides non-next tasks of sequential projects from
    // action lists (Today/Upcoming); here we surface which one it is
    // directly on the project page, where all tasks are visible.
    const nextActionTask = useMemo(() => {
        if (project?.execution_mode !== 'sequential') return null;
        const sorted = [...displayTasks].sort((a, b) => {
            if (a.order == null && b.order == null) return 0;
            if (a.order == null) return 1;
            if (b.order == null) return -1;
            return a.order - b.order;
        });
        return (
            sorted.find(
                (task) => !NON_ACTIONABLE_STATUSES.includes(task.status)
            ) || null
        );
    }, [project?.execution_mode, displayTasks]);

    return (
        <div className="xl:col-span-2 flex flex-col gap-2">
            {nextActionTask && (
                <div
                    data-testid="project-next-action-callout"
                    className="flex items-center gap-2 px-3 py-2 rounded bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 text-sm"
                >
                    <QueueListIcon className="h-4 w-4 flex-shrink-0" />
                    <span>
                        {t('projects.nextAction', 'Next action')}:{' '}
                        <strong>{nextActionTask.name}</strong>
                    </span>
                </div>
            )}

            {showAutoSuggestForm && (
                <div className="transition-all duration-300 ease-in-out opacity-100 transform translate-y-0">
                    <AutoSuggestNextActionBox
                        onAddAction={(actionDescription) => {
                            if (project?.uid) {
                                onAddNextAction(project.uid, actionDescription);
                            }
                        }}
                        onDismiss={onDismissNextAction}
                    />
                </div>
            )}

            <div className="transition-all duration-300 ease-in-out overflow-visible opacity-100 transform translate-y-0">
                <NewTask onTaskCreate={onTaskCreate} />
            </div>

            <div className="transition-all duration-300 ease-in-out overflow-visible">
                {displayTasks.length > 0 ? (
                    <div className="transition-all duration-300 ease-in-out opacity-100 transform translate-y-0 overflow-visible">
                        <TaskList
                            tasks={displayTasks}
                            onTaskUpdate={onTaskUpdate}
                            onTaskCompletionToggle={onTaskCompletionToggle}
                            onTaskDelete={onTaskDelete}
                            projects={allProjects}
                            hideProjectName={true}
                            onToggleToday={onToggleToday}
                            showCompletedTasks={showCompleted}
                        />
                    </div>
                ) : (
                    <div className="transition-all duration-300 ease-in-out opacity-100 transform translate-y-0">
                        <p className="text-gray-500 dark:text-gray-400">
                            {taskSearchQuery.trim()
                                ? t(
                                      'tasks.noTasksAvailable',
                                      'No tasks available.'
                                  )
                                : showCompleted
                                  ? t(
                                        'project.noCompletedTasks',
                                        'No completed tasks.'
                                    )
                                  : t('project.noTasks', 'No tasks.')}
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ProjectTasksSection;
