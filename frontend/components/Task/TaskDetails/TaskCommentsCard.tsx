import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import useSWR from 'swr';
import { fetchComments, createComment, updateComment, deleteComment } from '../../../utils/commentsService';
import { Task } from '../../../entities/Task';
import { useStore } from '../../../store/useStore';
import { ChatBubbleLeftRightIcon } from '@heroicons/react/24/outline';
import { Comment } from '../../../entities/Comment';

interface TaskCommentsCardProps { task: Task; }

const TaskCommentsCard: React.FC<TaskCommentsCardProps> = ({ task }) => {
    const { t } = useTranslation();
    const [newContent, setNewContent] = useState('');
    const [editingUid, setEditingUid] = useState<string | null>(null);
    const [editContent, setEditContent] = useState('');
    const { data, mutate: mutateComments } = useSWR(task.uid ? `/api/task/${task.uid}/comments` : null, () => fetchComments(task.uid));
    const currentUser = useStore(s => s.authStore.user);

    const handleCreate = async () => {
        if (!newContent.trim()) return;
        await createComment(task.uid!, newContent.trim());
        setNewContent('');
        await mutateComments();
    };

    const handleUpdate = async (uid: string) => {
        if (!editContent.trim()) return;
        await updateComment(uid, editContent.trim());
        setEditingUid(null); setEditContent('');
        await mutateComments();
    };

    const handleDelete = async (uid: string) => {
        if (!confirm(t('comment.confirmDelete', 'Delete this comment?'))) return;
        await deleteComment(uid);
        await mutateComments();
    };

    return (
        <div className="rounded-lg shadow-sm bg-white dark:bg-gray-900 border-2 border-transparent p-3">
            <div className="flex items-center gap-2 mb-2">
                <ChatBubbleLeftRightIcon className="h-5 w-5 text-gray-400" />
                <span className="text-xs uppercase tracking-wide text-gray-500">{t('task.comments', 'Comments')}</span>
            </div>
            <div className="space-y-2 mb-3">
                {(data?.comments || []).map((c: Comment) => (
                    <div key={c.uid} className="p-2 bg-gray-50 dark:bg-gray-800 rounded">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-medium">{c.user?.name}</span>
                            <div className="flex gap-1">
                                {c.user?.id === currentUser?.id && (
                                    <>
                                        <button onClick={() => { setEditingUid(c.uid); setEditContent(c.content); }} className="text-xs text-blue-500">{t('common.edit', 'Edit')}</button>
                                        <button onClick={() => handleDelete(c.uid)} className="text-xs text-red-500">{t('common.delete', 'Delete')}</button>
                                    </>
                                )}
                            </div>
                        </div>
                        {editingUid === c.uid ? (
                            <div className="mt-1">
                                <textarea value={editContent} onChange={(e) => setEditContent(e.target.value)} className="w-full text-sm p-1 border rounded" />
                                <button onClick={() => handleUpdate(c.uid)} className="text-xs text-blue-500 mt-1">{t('common.save', 'Save')}</button>
                            </div>
                        ) : (
                            <p className="text-sm mt-1 whitespace-pre-wrap">{c.content}</p>
                        )}
                    </div>
                ))}
            </div>
            <textarea value={newContent} onChange={(e) => setNewContent(e.target.value)} placeholder={t('comment.placeholder', 'Add a comment...')} className="w-full text-sm p-2 border rounded" rows={2} />
            <button onClick={handleCreate} disabled={!newContent.trim()} className="mt-1 px-3 py-1 text-sm bg-blue-600 text-white rounded disabled:opacity-50">{t('comment.post', 'Post')}</button>
        </div>
    );
};
export default TaskCommentsCard;
