import { Goal } from '../entities/Goal';
import { handleAuthResponse, getPostHeadersWithCsrf } from './authUtils';
import { getApiPath } from '../config/paths';
import { getCsrfToken } from './csrfService';
import i18n from '../i18n';

export const fetchGoals = async (areaUid?: string): Promise<Goal[]> => {
    const url = areaUid ? `goals?area_uid=${areaUid}` : 'goals';
    const response = await fetch(getApiPath(url), {
        credentials: 'include',
        headers: { Accept: 'application/json' },
    });
    await handleAuthResponse(
        response,
        i18n.t('errors.fetchGoalsError', 'Failed to fetch goals.')
    );
    const data = await response.json();
    return data.goals;
};

export const createGoal = async (
    data: Omit<Goal, 'id' | 'uid' | 'user_id' | 'created_at' | 'updated_at'>
): Promise<{ goal: Goal; active_goals_count: number }> => {
    const response = await fetch(getApiPath('goals'), {
        method: 'POST',
        credentials: 'include',
        headers: await getPostHeadersWithCsrf(),
        body: JSON.stringify(data),
    });
    await handleAuthResponse(
        response,
        i18n.t('errors.createGoalError', 'Failed to create goal.')
    );
    return response.json();
};

export const updateGoal = async (
    uid: string,
    data: Partial<Goal>
): Promise<{ goal: Goal; active_goals_count: number }> => {
    const response = await fetch(getApiPath(`goals/${uid}`), {
        method: 'PATCH',
        credentials: 'include',
        headers: await getPostHeadersWithCsrf(),
        body: JSON.stringify(data),
    });
    await handleAuthResponse(
        response,
        i18n.t('errors.updateGoalError', 'Failed to update goal.')
    );
    return response.json();
};

export const deleteGoal = async (uid: string): Promise<void> => {
    const response = await fetch(getApiPath(`goals/${uid}`), {
        method: 'DELETE',
        credentials: 'include',
        headers: {
            Accept: 'application/json',
            'x-csrf-token': await getCsrfToken(),
        },
    });
    await handleAuthResponse(
        response,
        i18n.t('errors.deleteGoalError', 'Failed to delete goal.')
    );
};
