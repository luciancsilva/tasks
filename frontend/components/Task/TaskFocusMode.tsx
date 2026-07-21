import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { createPortal } from 'react-dom';
import { XMarkIcon, ForwardIcon } from '@heroicons/react/24/outline';
import { Task } from '../../entities/Task';
import { updateTask } from '../../utils/tasksService';
import { logFocusSession } from '../../utils/taskEventService';
import PomodoroTimer from '../Shared/PomodoroTimer';

interface TaskFocusModeProps {
    task: Task;
    nextTasks: Task[];
    onClose: () => void;
    onNext: (task: Task) => void;
}

const TaskFocusMode: React.FC<TaskFocusModeProps> = ({
    task,
    nextTasks,
    onClose,
    onNext,
}) => {
    const { t } = useTranslation();
    const [currentTask, setCurrentTask] = useState(task);
    const [sessionStart] = useState(() => new Date());
    const [completing, setCompleting] = useState(false);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                void handleClose();
            } else if (
                e.key === 'n' &&
                nextTasks.length > 0 &&
                !e.ctrlKey &&
                !e.metaKey
            ) {
                onNext(nextTasks[0]);
            }
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [nextTasks, onNext]);

    const logSession = async (targetUid: string, durationSec: number) => {
        try {
            await logFocusSession(
                targetUid,
                durationSec,
                sessionStart,
                new Date()
            );
        } catch {
            // best-effort; focus mode shouldn't block on logging failure
        }
    };

    const handleClose = async () => {
        const duration = Math.floor(
            (Date.now() - sessionStart.getTime()) / 1000
        );
        if (duration > 10) {
            await logSession(currentTask.uid as string, duration);
        }
        onClose();
    };

    const handleComplete = async () => {
        setCompleting(true);
        try {
            await updateTask(currentTask.uid as string, { status: 2 });
        } finally {
            setCompleting(false);
        }
    };

    return createPortal(
        <div className="fixed inset-0 z-[100] bg-white dark:bg-gray-900 flex flex-col">
            <div className="flex items-center justify-between p-4 border-b dark:border-gray-700 gap-3">
                <h1 className="text-xl font-semibold truncate text-gray-900 dark:text-white">
                    {currentTask.name}
                </h1>
                <div className="flex items-center gap-3 shrink-0">
                    <PomodoroTimer
                        currentTaskUid={currentTask.uid}
                        defaultTimeSec={
                            currentTask.time_estimate
                                ? currentTask.time_estimate * 60
                                : undefined
                        }
                        onPomodoroComplete={(dur) =>
                            void logSession(currentTask.uid as string, dur)
                        }
                    />
                    {nextTasks.length > 0 && (
                        <button
                            onClick={() => onNext(nextTasks[0])}
                            className="flex items-center gap-1 px-3 py-2 rounded bg-blue-600 text-white hover:bg-blue-700"
                        >
                            <ForwardIcon className="h-4 w-4" />{' '}
                            {t('focus.next', 'Next')}
                        </button>
                    )}
                    <button
                        onClick={() => void handleClose()}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-gray-700 dark:text-gray-200"
                        aria-label={t('common.close', 'Close')}
                    >
                        <XMarkIcon className="h-5 w-5" />
                    </button>
                </div>
            </div>
            <div className="flex-1 overflow-auto p-8 max-w-3xl mx-auto w-full">
                {currentTask.note ? (
                    <div
                        className="prose dark:prose-invert max-w-none text-gray-900 dark:text-gray-100"
                        dangerouslySetInnerHTML={{
                            __html: currentTask.note,
                        }}
                    />
                ) : (
                    <p className="text-gray-400 dark:text-gray-500 italic">
                        {t('focus.noNotes', 'No notes for this task.')}
                    </p>
                )}
                <button
                    onClick={() => void handleComplete()}
                    disabled={completing}
                    className="mt-6 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                >
                    {completing
                        ? t('common.saving', 'Saving...')
                        : t('task.complete', 'Complete')}
                </button>
            </div>
        </div>,
        document.body
    );
};

export default TaskFocusMode;
