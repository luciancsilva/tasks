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
