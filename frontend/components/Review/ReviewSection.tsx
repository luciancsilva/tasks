import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronDownIcon, ChevronRightIcon } from '@heroicons/react/24/solid';
import type { ReviewSectionData } from '../../utils/reviewsService';

interface ReviewItemRowProps {
    item: {
        uid: string;
        name: string;
        type: string;
        href: string;
        meta?: Record<string, unknown>;
    };
}

const ReviewItemRow: React.FC<ReviewItemRowProps> = ({ item }) => {
    const navigate = useNavigate();
    const meta = item.meta || {};
    return (
        <button
            onClick={() => navigate(item.href)}
            className="w-full text-left p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded flex items-center justify-between"
        >
            <span className="truncate">{item.name}</span>
            <span className="flex items-center gap-2 text-xs">
                {typeof meta.days_stale === 'number' && (
                    <span className="text-red-500 dark:text-red-400">
                        {meta.days_stale}d
                    </span>
                )}
                {typeof meta.waiting_since_days === 'number' && (
                    <span className="text-amber-500 dark:text-amber-400">
                        {meta.waiting_since_days}d
                    </span>
                )}
                {typeof meta.due_date === 'string' &&
                    meta.due_date && (
                        <span className="text-gray-500 dark:text-gray-400">
                            {new Date(meta.due_date).toLocaleDateString()}
                        </span>
                    )}
            </span>
        </button>
    );
};

interface ReviewItem {
    uid: string;
    name: string;
    type: string;
    href: string;
    meta?: Record<string, unknown>;
}

interface ReviewSectionProps {
    section: ReviewSectionData;
    checked: boolean;
    onToggle: () => void;
}

const ALERT_SECTIONS = new Set(['inbox', 'stale', 'stalled', 'waiting']);

const ReviewSection: React.FC<ReviewSectionProps> = ({
    section,
    checked,
    onToggle,
}) => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [open, setOpen] = useState(true);

    const isAlert = ALERT_SECTIONS.has(section.id);
    const hasCount = section.count != null && section.count > 0;
    const badgeClass = isAlert
        ? hasCount
            ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200'
            : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-300'
        : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-300';

    return (
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="flex items-center px-4 py-3 bg-white dark:bg-gray-800">
                <button
                    onClick={() => setOpen((v) => !v)}
                    className="mr-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                    aria-label={open ? 'collapse' : 'expand'}
                >
                    {open ? (
                        <ChevronDownIcon className="h-4 w-4" />
                    ) : (
                        <ChevronRightIcon className="h-4 w-4" />
                    )}
                </button>
                <input
                    type="checkbox"
                    checked={checked}
                    onChange={onToggle}
                    className="mr-3 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="flex-1 font-medium text-gray-900 dark:text-white">
                    {t(section.title_key, section.id)}
                </span>
                <span
                    className={`ml-2 px-2 py-0.5 text-xs rounded-full ${badgeClass}`}
                >
                    {section.count == null ? '—' : section.count}
                </span>
            </div>
            {open && (
                <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-700">
                    {section.ready && section.items.length > 0 && (
                        <div className="space-y-1">
                            {section.items.map((item) => (
                                <ReviewItemRow
                                    key={(item as ReviewItem).uid}
                                    item={item as ReviewItem}
                                />
                            ))}
                        </div>
                    )}
                    {section.ready && section.items.length === 0 && (
                        <p className="text-sm text-gray-400 dark:text-gray-500">
                            {t('review.empty', 'All clear')}
                        </p>
                    )}
                    {!section.ready && (
                        <p className="text-sm italic text-gray-400 dark:text-gray-500">
                            {t('review.sectionPlaceholder', 'Coming soon')}
                        </p>
                    )}
                    {section.href && (
                        <button
                            onClick={() => navigate(section.href)}
                            className="text-xs text-blue-500 dark:text-blue-400 mt-2 hover:underline"
                        >
                            {t('review.openFull', 'Open full list')}
                        </button>
                    )}
                </div>
            )}
        </div>
    );
};

export default ReviewSection;
