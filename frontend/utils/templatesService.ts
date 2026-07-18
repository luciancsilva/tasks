import {
    Template,
    CloneTemplateOptions,
    SaveAsTemplateOptions,
} from '../entities/Template';
import { Project } from '../entities/Project';
import { handleAuthResponse } from './authUtils';
import { getApiPath } from '../config/paths';
import { getCsrfToken } from './csrfService';

export const fetchTemplates = async (): Promise<Template[]> => {
    const response = await fetch(getApiPath('templates'), {
        credentials: 'include',
        headers: { Accept: 'application/json' },
    });
    await handleAuthResponse(response, 'Failed to fetch templates.');
    const data = await response.json();
    return data.templates || [];
};

export const fetchTemplate = async (uid: string): Promise<Template> => {
    const response = await fetch(getApiPath(`template/${uid}`), {
        credentials: 'include',
        headers: { Accept: 'application/json' },
    });
    await handleAuthResponse(response, 'Failed to fetch template.');
    return await response.json();
};

export const createTemplate = async (
    data: Partial<Template>
): Promise<Template> => {
    const token = await getCsrfToken();
    const response = await fetch(getApiPath('template'), {
        method: 'POST',
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            'x-csrf-token': token,
        },
        body: JSON.stringify(data),
    });
    await handleAuthResponse(response, 'Failed to create template.');
    return await response.json();
};

export const updateTemplate = async (
    uid: string,
    data: Partial<Template>
): Promise<Template> => {
    const token = await getCsrfToken();
    const response = await fetch(getApiPath(`template/${uid}`), {
        method: 'PATCH',
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            'x-csrf-token': token,
        },
        body: JSON.stringify(data),
    });
    await handleAuthResponse(response, 'Failed to update template.');
    return await response.json();
};

export const deleteTemplate = async (uid: string): Promise<void> => {
    const token = await getCsrfToken();
    const response = await fetch(getApiPath(`template/${uid}`), {
        method: 'DELETE',
        credentials: 'include',
        headers: { Accept: 'application/json', 'x-csrf-token': token },
    });
    await handleAuthResponse(response, 'Failed to delete template.');
};

export const saveProjectAsTemplate = async (
    projectUid: string,
    options: SaveAsTemplateOptions = {}
): Promise<Template> => {
    const token = await getCsrfToken();
    const response = await fetch(
        getApiPath(`project/${projectUid}/save-as-template`),
        {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
                'x-csrf-token': token,
            },
            body: JSON.stringify(options),
        }
    );
    await handleAuthResponse(response, 'Failed to save project as template.');
    return await response.json();
};

export const cloneTemplate = async (
    templateUid: string,
    options: CloneTemplateOptions = {}
): Promise<Project> => {
    const token = await getCsrfToken();
    const response = await fetch(getApiPath(`template/${templateUid}/clone`), {
        method: 'POST',
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            'x-csrf-token': token,
        },
        body: JSON.stringify(options),
    });
    await handleAuthResponse(response, 'Failed to clone template.');
    return await response.json();
};
