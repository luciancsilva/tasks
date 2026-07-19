import { getApiPath } from '../config/paths';
import { getPostHeadersWithCsrf, handleAuthResponse } from './authUtils';

export interface ReviewsStatus {
    last_reviewed_at: string | null;
    days_since: number | null;
    suggested: boolean;
}

export interface ReviewSectionData {
    id: string;
    title_key: string;
    count: number | null;
    items: unknown[];
    ready: boolean;
    href?: string;
    follow_up_overdue_count?: number;
}

export interface ReviewsSections {
    sections: ReviewSectionData[];
}

export async function fetchReviewsStatus(): Promise<ReviewsStatus> {
    const response = await fetch(getApiPath('/reviews/status'), {
        credentials: 'include',
        headers: {
            Accept: 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
        },
    });
    await handleAuthResponse(response, 'Failed to fetch review status');
    return response.json();
}

export async function fetchReviewsSections(): Promise<ReviewsSections> {
    const response = await fetch(getApiPath('/reviews/sections'), {
        credentials: 'include',
        headers: {
            Accept: 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
        },
    });
    await handleAuthResponse(response, 'Failed to fetch review sections');
    return response.json();
}

export async function markReviewComplete(): Promise<ReviewsStatus> {
    const response = await fetch(getApiPath('/reviews/complete'), {
        method: 'POST',
        credentials: 'include',
        headers: await getPostHeadersWithCsrf(),
    });
    await handleAuthResponse(response, 'Failed to mark review complete');
    return response.json();
}
