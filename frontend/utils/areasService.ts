import { Area } from '../entities/Area';
import { handleAuthResponse, getPostHeadersWithCsrf } from './authUtils';
import { getApiPath } from '../config/paths';
import { getCsrfToken } from './csrfService';
import i18n from '../i18n';

export const fetchAreas = async (): Promise<Area[]> => {
    const response = await fetch(getApiPath('areas'), {
        credentials: 'include',
        headers: {
            Accept: 'application/json',
        },
    });
    await handleAuthResponse(
        response,
        i18n.t('area.loadError', 'Failed to fetch areas.')
    );
    return await response.json();
};

export const createArea = async (areaData: Partial<Area>): Promise<Area> => {
    const response = await fetch(getApiPath('areas'), {
        method: 'POST',
        credentials: 'include',
        headers: await getPostHeadersWithCsrf(),
        body: JSON.stringify(areaData),
    });

    await handleAuthResponse(
        response,
        i18n.t('errors.failedToSaveArea', 'Failed to create area.')
    );
    return await response.json();
};

export const updateArea = async (
    areaUid: string,
    areaData: Partial<Area>
): Promise<Area> => {
    const response = await fetch(getApiPath(`areas/${areaUid}`), {
        method: 'PATCH',
        credentials: 'include',
        headers: await getPostHeadersWithCsrf(),
        body: JSON.stringify(areaData),
    });

    await handleAuthResponse(
        response,
        i18n.t('errors.failedToSaveArea', 'Failed to update area.')
    );
    return await response.json();
};

export const deleteArea = async (areaUid: string): Promise<void> => {
    const response = await fetch(getApiPath(`areas/${areaUid}`), {
        method: 'DELETE',
        credentials: 'include',
        headers: {
            Accept: 'application/json',
            'x-csrf-token': await getCsrfToken(),
        },
    });

    await handleAuthResponse(
        response,
        i18n.t('errors.failedToDeleteArea', 'Failed to delete area.')
    );
};
