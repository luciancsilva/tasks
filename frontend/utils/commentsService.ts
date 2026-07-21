import {
    handleAuthResponse,
    getDefaultHeaders,
    getPostHeadersWithCsrf,
} from './authUtils';
import { getApiPath } from '../config/paths';
import { Comment } from '../entities/Comment';
import i18n from '../i18n';

export async function fetchComments(
    taskUid: string
): Promise<{ comments: Comment[] }> {
    const response = await fetch(
        getApiPath(`task/${encodeURIComponent(taskUid)}/comments`),
        {
            credentials: 'include',
            headers: getDefaultHeaders(),
        }
    );

    await handleAuthResponse(
        response,
        i18n.t('errors.failedToLoadComments', 'Failed to fetch comments.')
    );
    return await response.json();
}

export async function createComment(
    taskUid: string,
    content: string
): Promise<Comment> {
    const response = await fetch(
        getApiPath(`task/${encodeURIComponent(taskUid)}/comments`),
        {
            method: 'POST',
            credentials: 'include',
            headers: await getPostHeadersWithCsrf(),
            body: JSON.stringify({ content }),
        }
    );

    await handleAuthResponse(
        response,
        i18n.t('errors.failedToCreateComment', 'Failed to create comment.')
    );
    return await response.json();
}

export async function updateComment(
    commentUid: string,
    content: string
): Promise<Comment> {
    const response = await fetch(
        getApiPath(`comment/${encodeURIComponent(commentUid)}`),
        {
            method: 'PATCH',
            credentials: 'include',
            headers: await getPostHeadersWithCsrf(),
            body: JSON.stringify({ content }),
        }
    );

    await handleAuthResponse(
        response,
        i18n.t('errors.failedToUpdateComment', 'Failed to update comment.')
    );
    return await response.json();
}

export async function deleteComment(commentUid: string): Promise<void> {
    const response = await fetch(
        getApiPath(`comment/${encodeURIComponent(commentUid)}`),
        {
            method: 'DELETE',
            credentials: 'include',
            headers: await getPostHeadersWithCsrf(),
        }
    );

    await handleAuthResponse(
        response,
        i18n.t('errors.failedToDeleteComment', 'Failed to delete comment.')
    );
}
