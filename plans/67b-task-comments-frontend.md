# 67b — Task comments (frontend: card + UI)

> **Status: EXECUTADO** em 2026-07-19 — `TaskCommentsCard` (SWR) + post/edit/
> delete pelo autor + `commentsService.ts`, montado em TaskDetails.

> **Status: PROPOSTO** — UI de comments no TaskDetails. Backend no plano 67a.
> **Esforço:** Médio · **Natureza:** julgamento baixo · **Modelo:** médio
> **Branch:** `feat/67-task-comments` · **Depende de:** 67a

## Contexto

Refs:
- `TaskDetails.tsx` cards stack `:1335-1379` (TaskProjectCard, TaskAreaCard, TaskAssignedToCard, etc.).
- `TaskAssignedToCard.tsx` template de card (props `:9-12`, shell `:30-40`).
- SWR para fetch (`useSWR`).

## 1. Baseline
```bash
npm run backend:test && npm run frontend:test
```
Confirmar 67a na branch.

## 2. Frontend — service
`frontend/utils/commentsService.ts`:
```ts
import { fetcher } from './fetcher';

export async function fetchComments(taskUid: string) {
    return fetcher(`/api/task/${taskUid}/comments`);
}
export async function createComment(taskUid: string, content: string) {
    const res = await fetch(`/api/task/${taskUid}/comments`, { method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content }) });
    if (!res.ok) throw new Error('Create comment failed');
    return res.json();
}
export async function updateComment(commentUid: string, content: string) {
    const res = await fetch(`/api/comment/${commentUid}`, { method: 'PATCH', credentials: 'include',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content }) });
    if (!res.ok) throw new Error('Update comment failed');
    return res.json();
}
export async function deleteComment(commentUid: string) {
    const res = await fetch(`/api/comment/${commentUid}`, { method: 'DELETE', credentials: 'include' });
    if (!res.ok) throw new Error('Delete comment failed');
}
```

## 3. Frontend — TaskCommentsCard
Crie `frontend/components/Task/TaskDetails/TaskCommentsCard.tsx`:
```tsx
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import useSWR, { mutate } from 'swr';
import { fetchComments, createComment, updateComment, deleteComment } from '../../../utils/commentsService';
import { Task } from '../../../entities/Task';
import { useStore } from '../../../store/useStore';

interface TaskCommentsCardProps { task: Task; }

const TaskCommentsCard: React.FC<TaskCommentsCardProps> = ({ task }) => {
    const { t } = useTranslation();
    const [newContent, setNewContent] = useState('');
    const [editingUid, setEditingUid] = useState<string | null>(null);
    const [editContent, setEditContent] = useState('');
    const { data, mutate: mutateComments } = useSWR(task.uid ? `/api/task/${task.uid}/comments` : null, () => fetchComments(task.uid));
    const currentUser = useStore(s => s.userSettingsStore); // ajustar para pegar currentUser real

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
                {(data?.comments || []).map(c => (
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
```
Importe `ChatBubbleLeftRightIcon` de `@heroicons/react/24/outline`.

## 4. Frontend — mount em TaskDetails
`TaskDetails.tsx`: importe `TaskCommentsCard` (`:24-37`). Renderize após `TaskSubtasksCard` (ou ao final da stack `:1335-1379`):
```tsx
<TaskCommentsCard task={task} />
```

## 5. Frontend — Entity TS
`frontend/entities/Task.ts`: sem mudança (comments fetched separadamente).
Crie `frontend/entities/Comment.ts`:
```ts
export interface Comment {
    uid: string;
    task_id: number;
    user_id: number;
    content: string;
    created_at: string;
    updated_at: string;
    user?: { id: number; name: string; email: string };
}
```

## 6. Frontend — store (currentUser)
Confirmar acesso a `currentUser` (id) para checar autor. `useStore` tem `userSettingsStore`; verificar se há `currentUser` em outro slice. Se não, buscar via `/api/profile` ou Context. Ajustar `c.user?.id === currentUser?.id` conforme estrutura real.

## 7. i18n
Chaves `task.comments`, `comment.placeholder`, `comment.post`, `comment.confirmDelete` em PT/EN.

## 8. Testes — frontend
`frontend/__tests__/`:
- `TaskCommentsCard` renderiza lista; post cria comment; edit/delete visíveis só para autor.
- Mock SWR com comments fixture.

## 9. Lint
```bash
cd frontend && npx eslint --fix components/Task/TaskDetails/TaskCommentsCard.tsx components/Task/TaskDetails/index.ts components/Task/TaskDetails.tsx utils/commentsService.ts entities/Comment.ts
```

## Critério de pronto
- [ ] `TaskCommentsCard` renderiza no TaskDetails; lista comments ASC.
- [ ] Post cria comment; edit/delete para autor; confirm em delete.
- [ ] SWR revalida após create/update/delete.
- [ ] Suítes verde; lint limpo.

## Commit
`feat(comments): task comments UI in TaskDetails` — "Implements plans/67b". Branch `feat/67-task-comments`.

## Fora de escopo
- @mention chips (não aprovado).
- Markdown render (não aprovado).
- Real-time updates (SWR poll/revalidate basta v1).
