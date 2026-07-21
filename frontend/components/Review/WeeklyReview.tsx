import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import useSWR from 'swr';
import {
    fetchReviewsStatus,
    fetchReviewsSections,
    markReviewComplete,
} from '../../utils/reviewsService';
import { useToast } from '../Shared/ToastContext';
import ReviewSection from './ReviewSection';

const WeeklyReview: React.FC = () => {
    const { t } = useTranslation();
    const { showSuccessToast, showErrorToast } = useToast();
    const {
        data: status,
        mutate: mutateStatus,
        isValidating,
    } = useSWR('/api/reviews/status', fetchReviewsStatus);
    const { data: sectionsData } = useSWR(
        '/api/reviews/sections',
        fetchReviewsSections
    );
    const [checklist, setChecklist] = useState<Record<string, boolean>>({});

    const handleComplete = async () => {
        try {
            await markReviewComplete();
            await mutateStatus();
            setChecklist({});
            showSuccessToast(
                t('review.completed', 'Weekly review marked complete')
            );
        } catch {
            showErrorToast(t('review.failed', 'Failed to mark complete'));
        }
    };

    const toggleSection = (id: string) =>
        setChecklist((prev) => ({ ...prev, [id]: !prev[id] }));

    return (
        <div className="max-w-4xl mx-auto p-4">
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                    {t('review.title', 'Weekly Review')}
                </h1>
                <div className="flex items-center gap-3">
                    {status?.last_reviewed_at && (
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                            {t('review.lastCompleted', 'Last:')}{' '}
                            {new Date(
                                status.last_reviewed_at
                            ).toLocaleDateString()}
                        </span>
                    )}
                    {status?.suggested && (
                        <span className="px-2 py-1 text-xs rounded bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-200">
                            {t('review.due', 'Due')}
                        </span>
                    )}
                    <button
                        onClick={handleComplete}
                        disabled={isValidating}
                        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                    >
                        {t('review.markComplete', 'Mark complete')}
                    </button>
                </div>
            </div>
            <div className="space-y-4">
                {(sectionsData?.sections || []).map((section) => (
                    <ReviewSection
                        key={section.id}
                        section={section}
                        checked={!!checklist[section.id]}
                        onToggle={() => toggleSection(section.id)}
                    />
                ))}
            </div>
        </div>
    );
};

export default WeeklyReview;
