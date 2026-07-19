import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import {
    InformationCircleIcon,
    BookmarkIcon,
    ChevronDownIcon,
    ChevronUpIcon,
} from '@heroicons/react/24/outline';
import FilterBadge from './FilterBadge';
import SearchResults from './SearchResults';
import { useToast } from '../Shared/ToastContext';
import { getApiPath } from '../../config/paths';
import { getCsrfToken } from '../../utils/csrfService';

interface SearchMenuProps {
    searchQuery: string;
    selectedFilters: string[];
    onFilterToggle: (filter: string) => void;
    onClose: () => void;
}

const filterTypes = [
    {
        value: 'Task',
        labelKey: 'search.entityTypes.task',
        fallback: 'task',
        color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    },
    {
        value: 'Project',
        labelKey: 'search.entityTypes.project',
        fallback: 'project',
        color: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
    },
    {
        value: 'Area',
        labelKey: 'search.entityTypes.area',
        fallback: 'area',
        color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    },
    {
        value: 'Note',
        labelKey: 'search.entityTypes.note',
        fallback: 'note',
        color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    },
    {
        value: 'Person',
        labelKey: 'search.entityTypes.person',
        fallback: 'person',
        color: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200',
    },
];

const priorityOptions = [
    { value: 'high', labelKey: 'priority.high', fallback: 'High' },
    { value: 'medium', labelKey: 'priority.medium', fallback: 'Medium' },
    { value: 'low', labelKey: 'priority.low', fallback: 'Low' },
];

// Plan 51: mental-energy filter slots in the universal search menu.
const energyOptions = [
    { value: 'high', labelKey: 'search.energyHigh', fallback: 'High energy' },
    { value: 'medium', labelKey: 'search.energyMedium', fallback: 'Medium' },
    { value: 'low', labelKey: 'search.energyLow', fallback: 'Low energy' },
];

// Plan 52: time-available filter slots (upper bound, in minutes).
const timeOptions = [
    { value: '15', labelKey: 'search.time15', fallback: '≤ 15 min' },
    { value: '30', labelKey: 'search.time30', fallback: '≤ 30 min' },
    { value: '60', labelKey: 'search.time60', fallback: '≤ 1h' },
    { value: '120', labelKey: 'search.time120', fallback: '≤ 2h' },
];

const dueOptions = [
    { value: 'today', labelKey: 'dateIndicators.today', fallback: 'Today' },
    { value: 'tomorrow', labelKey: 'dateIndicators.tomorrow', fallback: 'Tomorrow' },
    { value: 'next_week', labelKey: 'dateIndicators.nextWeek', fallback: 'Next Week' },
    { value: 'next_month', labelKey: 'dateIndicators.nextMonth', fallback: 'Next Month' },
];

const deferOptions = [
    { value: 'today', labelKey: 'dateIndicators.today', fallback: 'Today' },
    { value: 'tomorrow', labelKey: 'dateIndicators.tomorrow', fallback: 'Tomorrow' },
    { value: 'next_week', labelKey: 'dateIndicators.nextWeek', fallback: 'Next Week' },
    { value: 'next_month', labelKey: 'dateIndicators.nextMonth', fallback: 'Next Month' },
];

const extrasOptions = [
    { value: 'recurring', labelKey: 'search.extrasFilter.isRecurring', fallback: 'is Recurring' },
    { value: 'overdue', labelKey: 'search.extrasFilter.isOverdue', fallback: 'is Overdue' },
    { value: 'has_content', labelKey: 'search.extrasFilter.hasContent', fallback: 'has Content' },
    { value: 'deferred', labelKey: 'search.extrasFilter.isDeferred', fallback: 'is Deferred' },
    { value: 'has_tags', labelKey: 'search.extrasFilter.hasTags', fallback: 'has Tags' },
    {
        value: 'assigned_to_project',
        labelKey: 'search.extrasFilter.isAssignedToProject',
        fallback: 'is Assigned to Project',
    },
];

const SearchMenu: React.FC<SearchMenuProps> = ({
    searchQuery,
    selectedFilters,
    onFilterToggle,
    onClose,
}) => {
    const { t } = useTranslation();
    const { showSuccessToast, showErrorToast } = useToast();
    const [selectedPriority, setSelectedPriority] = useState<string | null>(
        null
    );
    const [selectedEnergy, setSelectedEnergy] = useState<string | null>(null);
    const [selectedTimeMax, setSelectedTimeMax] = useState<string | null>(null);
    const [selectedDue, setSelectedDue] = useState<string | null>(null);
    // Plan 58: custom due-date range (absolute, YYYY-MM-DD).
    const [dueFrom, setDueFrom] = useState<string | null>(null);
    const [dueTo, setDueTo] = useState<string | null>(null);
    const [selectedDefer, setSelectedDefer] = useState<string | null>(null);
    const [selectedTags, setSelectedTags] = useState<string[]>([]);
    // Plan 57: tags_any — OR semantics (task has ANY of these tags).
    const [selectedTagsAny, setSelectedTagsAny] = useState<string[]>([]);
    const [selectedExtras, setSelectedExtras] = useState<string[]>([]);
    const [availableTags, setAvailableTags] = useState<
        Array<{ id: number; name: string }>
    >([]);
    const [showSaveForm, setShowSaveForm] = useState(false);
    const [viewName, setViewName] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [saveError, setSaveError] = useState('');
    const [showCriteria, setShowCriteria] = useState(false);

    // Fetch available tags
    useEffect(() => {
        const fetchTags = async () => {
            try {
                const response = await fetch(getApiPath('tags'), {
                    credentials: 'include',
                });
                if (response.ok) {
                    const tags = await response.json();
                    setAvailableTags(tags);
                }
            } catch (error) {
                console.error('Error fetching tags:', error);
            }
        };
        fetchTags();
    }, []);

    const handlePriorityToggle = (priority: string) => {
        setSelectedPriority(selectedPriority === priority ? null : priority);
    };

    // Plan 51: energy filter toggle.
    const handleEnergyToggle = (energy: string) => {
        setSelectedEnergy(selectedEnergy === energy ? null : energy);
    };

    // Plan 52: time-available filter toggle.
    const handleTimeMaxToggle = (timeMax: string) => {
        setSelectedTimeMax(selectedTimeMax === timeMax ? null : timeMax);
    };

    const handleDueToggle = (due: string) => {
        setSelectedDue(selectedDue === due ? null : due);
    };

    const handleDeferToggle = (defer: string) => {
        setSelectedDefer(selectedDefer === defer ? null : defer);
    };

    const handleTagToggle = (tagName: string) => {
        setSelectedTags((prev) =>
            prev.includes(tagName)
                ? prev.filter((t) => t !== tagName)
                : [...prev, tagName]
        );
    };

    const handleTagAnyToggle = (tagName: string) => {
        setSelectedTagsAny((prev) =>
            prev.includes(tagName)
                ? prev.filter((t) => t !== tagName)
                : [...prev, tagName]
        );
    };

    const handleExtrasToggle = (extra: string) => {
        setSelectedExtras((prev) =>
            prev.includes(extra)
                ? prev.filter((e) => e !== extra)
                : [...prev, extra]
        );
    };

    const handleSaveView = async () => {
        if (!viewName.trim()) {
            setSaveError(t('search.viewNameRequired', 'View name is required'));
            return;
        }

        setIsSaving(true);
        setSaveError('');

        try {
            const response = await fetch(getApiPath('views'), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-csrf-token': await getCsrfToken(),
                },
                credentials: 'include',
                body: JSON.stringify({
                    name: viewName.trim(),
                    search_query: searchQuery || null,
                    filters: selectedFilters,
                    priority: selectedPriority || null,
                    energy: selectedEnergy || null,
                    time_max: selectedTimeMax ? Number(selectedTimeMax) : null,
                    due: selectedDue || null,
                    due_from: dueFrom || null,
                    due_to: dueTo || null,
                    defer: selectedDefer || null,
                    tags: selectedTags.length > 0 ? selectedTags : null,
                    tags_any:
                        selectedTagsAny.length > 0 ? selectedTagsAny : null,
                    extras: selectedExtras.length > 0 ? selectedExtras : null,
                }),
            });

            if (!response.ok) {
                throw new Error(t('errors.failedToSaveView', 'Failed to save view'));
            }

            const savedView = await response.json();

            // Reset form
            setViewName('');
            setShowSaveForm(false);
            setSaveError('');

            // Show success toast with link to the view
            showSuccessToast(
                <div className="flex items-center gap-2">
                    <span>{t('views.viewSavedSuccessfully', 'View saved successfully!')}</span>
                    <Link
                        to={`/views/${savedView.uid}`}
                        className="underline font-semibold hover:text-green-100"
                        onClick={onClose}
                    >
                        {t('search.viewNow', 'View now')}
                    </Link>
                </div>
            );

            // Notify sidebar to refresh
            window.dispatchEvent(new CustomEvent('viewUpdated'));
        } catch (err) {
            setSaveError(t('search.failedToSave', 'Failed to save view. Please try again.'));
            showErrorToast(t('views.saveError', 'Failed to save view'));
            console.error('Error saving view:', err);
        } finally {
            setIsSaving(false);
        }
    };

    const handleCancelSave = () => {
        setShowSaveForm(false);
        setViewName('');
        setSaveError('');
    };

    const buildSearchDescription = () => {
        const parts: React.ReactNode[] = [];

        // Build entity types part
        if (selectedFilters.length > 0) {
            const entities = selectedFilters.map((f) => (
                <span key={f} style={{ fontWeight: 800, fontStyle: 'normal' }}>
                    {t(`search.entityTypes.${f.toLowerCase()}`, f.toLowerCase())}s
                </span>
            ));
            const entitiesWithSeparators: React.ReactNode[] = [];
            entities.forEach((entity, index) => {
                if (index > 0) {
                    entitiesWithSeparators.push(
                        <span key={`sep-entity-${index}`}>
                            {' ' + t('search.and', 'and') + ' '}
                        </span>
                    );
                }
                entitiesWithSeparators.push(entity);
            });
            parts.push(...entitiesWithSeparators);
        } else {
            // If no specific entities selected, show "all items"
            parts.push(
                <span
                    key="all"
                    style={{ fontWeight: 800, fontStyle: 'normal' }}
                >
                    {t('search.allItems', 'all items')}
                </span>
            );
        }

        // Add search query
        if (searchQuery.trim()) {
            parts.push(
                <span key="query-label">
                    {t('search.containingText', ', containing the text') + ' '}
                </span>
            );
            parts.push(
                <span
                    key="query"
                    style={{ fontWeight: 800, fontStyle: 'normal' }}
                >
                    &quot;{searchQuery.trim()}&quot;
                </span>
            );
        }

        // Add priority filter
        if (selectedPriority) {
            parts.push(
                <span key="priority-label">
                    {t('search.withPriority', ', with') + ' '}
                </span>
            );
            parts.push(
                <span
                    key="priority"
                    style={{ fontWeight: 800, fontStyle: 'normal' }}
                >
                    {selectedPriority}
                </span>
            );
            parts.push(
                <span key="priority-suffix">{' ' + t('search.priority', 'priority')}</span>
            );
        }

        // Plan 51: energy filter.
        if (selectedEnergy) {
            parts.push(
                <span key="energy-label">
                    {t('search.withEnergy', ', with') + ' '}
                </span>
            );
            parts.push(
                <span
                    key="energy"
                    style={{ fontWeight: 800, fontStyle: 'normal' }}
                >
                    {selectedEnergy}
                </span>
            );
            parts.push(
                <span key="energy-suffix">{' ' + t('search.energy', 'energy')}</span>
            );
        }

        // Plan 52: time-available filter.
        if (selectedTimeMax) {
            parts.push(
                <span key="time-label">
                    {t('search.withTimeMax', ', ≤') + ' '}
                </span>
            );
            parts.push(
                <span
                    key="time"
                    style={{ fontWeight: 800, fontStyle: 'normal' }}
                >
                    {selectedTimeMax}
                </span>
            );
            parts.push(
                <span key="time-suffix">{' ' + t('search.minutes', 'min')}</span>
            );
        }

        // Add due date filter
        if (selectedDue) {
            const dueOption = dueOptions.find(
                (opt) => opt.value === selectedDue
            );
            const dueLabel = dueOption ? t(dueOption.labelKey, dueOption.fallback) : selectedDue;
            const dueText = t('search.dueLabel', ', due');
            parts.push(<span key="due-label">{dueText + ' '}</span>);
            parts.push(
                <span
                    key="due"
                    style={{ fontWeight: 800, fontStyle: 'normal' }}
                >
                    {dueLabel}
                </span>
            );
        }

        // Add defer until filter
        if (selectedDefer) {
            const deferOption = deferOptions.find(
                (opt) => opt.value === selectedDefer
            );
            const deferLabel = deferOption
                ? t(deferOption.labelKey, deferOption.fallback)
                : selectedDefer;
            parts.push(
                <span key="defer-label">{t('search.deferUntil', ', defer until') + ' '}</span>
            );
            parts.push(
                <span
                    key="defer"
                    style={{ fontWeight: 800, fontStyle: 'normal' }}
                >
                    {deferLabel}
                </span>
            );
        }

        // Add tags filter
        if (selectedTags.length > 0) {
            parts.push(
                <span key="tags-label">{t('search.taggedWith', ', tagged with') + ' '}</span>
            );
            const tagElements = selectedTags.map((tag) => (
                <span
                    key={`tag-${tag}`}
                    style={{ fontWeight: 800, fontStyle: 'normal' }}
                >
                    {tag}
                </span>
            ));
            const tagsWithSeparators: React.ReactNode[] = [];
            tagElements.forEach((tagEl, index) => {
                if (index > 0) {
                    if (index === tagElements.length - 1) {
                        tagsWithSeparators.push(
                            <span key={`sep-tag-and-${index}`}>
                                {' ' + t('search.and', 'and') + ' '}
                            </span>
                        );
                    } else {
                        tagsWithSeparators.push(
                            <span key={`sep-tag-comma-${index}`}>{', '}</span>
                        );
                    }
                }
                tagsWithSeparators.push(tagEl);
            });
            parts.push(...tagsWithSeparators);
        }

        // Add extras filters
        if (selectedExtras.length > 0) {
            parts.push(
                <span key="extras-label">{t('search.thatAre', ', that are') + ' '}</span>
            );
            const extrasElements = selectedExtras.map((extra) => {
                const extraOption = extrasOptions.find(
                    (opt) => opt.value === extra
                );
                const extraLabel = extraOption
                    ? t(extraOption.labelKey, extraOption.fallback)
                    : extra;
                return (
                    <span
                        key={`extra-${extra}`}
                        style={{ fontWeight: 800, fontStyle: 'normal' }}
                    >
                        {extraLabel}
                    </span>
                );
            });
            const extrasWithSeparators: React.ReactNode[] = [];
            extrasElements.forEach((extraEl, index) => {
                if (index > 0) {
                    if (index === extrasElements.length - 1) {
                        extrasWithSeparators.push(
                            <span key={`sep-extra-and-${index}`}>
                                {' ' + t('search.and', 'and') + ' '}
                            </span>
                        );
                    } else {
                        extrasWithSeparators.push(
                            <span key={`sep-extra-comma-${index}`}>{', '}</span>
                        );
                    }
                }
                extrasWithSeparators.push(extraEl);
            });
            parts.push(...extrasWithSeparators);
        }

        if (parts.length === 0) return null;

        // Construct the sentence
        return (
            <>
                {t('search.searchingFor', 'You are searching for')} {parts}
            </>
        );
    };

    const searchDescription = buildSearchDescription();
    const hasActiveFilters =
        selectedFilters.length > 0 ||
        searchQuery.trim() ||
        selectedPriority ||
        selectedEnergy ||
        selectedTimeMax ||
        selectedDue ||
        dueFrom ||
        dueTo ||
        selectedDefer ||
        selectedTags.length > 0 ||
        selectedTagsAny.length > 0 ||
        selectedExtras.length > 0;

    return (
        <div
            className="fixed left-1/2 transform -translate-x-1/2 top-32 md:top-20 w-[95vw] md:w-[90vw] max-w-full md:max-w-4xl h-[75vh] md:h-[80vh] max-h-[600px] md:max-h-[700px] bg-white dark:bg-gray-800 rounded-lg shadow-2xl border border-gray-200 dark:border-gray-700 z-50 flex flex-col"
            onMouseDown={(e) => {
                // Prevent input blur on mobile when clicking inside the search menu
                e.preventDefault();
            }}
            onTouchStart={(e) => {
                // Prevent input blur on mobile when touching inside the search menu
                e.preventDefault();
            }}
        >
            {/* Filter Badges Section */}
            <div className="border-b border-gray-200 dark:border-gray-700 overflow-y-auto max-h-[40vh] md:max-h-none">
                {/* Search Description */}
                {hasActiveFilters && searchDescription && (
                    <>
                        <div className="px-4 pt-4 pb-3 flex items-center gap-3">
                            <InformationCircleIcon className="h-6 w-6 text-black/30 dark:text-white/30 flex-shrink-0" />
                            <p
                                className="text-xl text-black/40 dark:text-white/40 flex-1"
                                style={{
                                    fontFamily: "'Lora', Georgia, serif",
                                    fontStyle: 'italic',
                                }}
                            >
                                {searchDescription}
                            </p>
                        </div>
                        <div className="border-t border-gray-300 dark:border-gray-600"></div>
                    </>
                )}

                {/* Toggle Criteria Button */}
                <div className="px-4 py-3">
                    <button
                        onClick={() => setShowCriteria(!showCriteria)}
                        className="flex items-center justify-between w-full text-left text-sm font-semibold text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
                    >
                        <span>{t('search.criteria', 'Search Criteria')}</span>
                        {showCriteria ? (
                            <ChevronUpIcon className="h-5 w-5" />
                        ) : (
                            <ChevronDownIcon className="h-5 w-5" />
                        )}
                    </button>
                </div>

                {/* Collapsible Criteria Section */}
                {showCriteria && (
                    <div className="px-4 pb-4">
                        {/* Entity Type Badges */}
                        <div className="flex flex-wrap gap-2">
                            {filterTypes.map((filter) => {
                                const isSelected = selectedFilters.includes(
                                    filter.value
                                );
                                return (
                                    <FilterBadge
                                        key={filter.value}
                                        name={t(filter.labelKey, filter.fallback)}
                                        color={filter.color}
                                        isSelected={isSelected}
                                        onToggle={() =>
                                            onFilterToggle(filter.value)
                                        }
                                    />
                                );
                            })}
                        </div>

                        {/* Divider */}
                        <div className="my-4 border-t border-gray-300 dark:border-gray-600"></div>

                        {/* Metadata Filters */}
                        <div className="space-y-3">
                            <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">
                                {t('search.metadataFilters', 'Metadata Filters')}
                            </div>

                            {/* Priority Filters */}
                            <div>
                                <div className="text-xs text-gray-500 dark:text-gray-400 mb-1.5">
                                    {t('search.priorityFilter', 'Priority')}
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {priorityOptions.map((option) => (
                                        <FilterBadge
                                            key={option.value}
                                            name={t(option.labelKey, option.fallback)}
                                            isSelected={
                                                selectedPriority ===
                                                option.value
                                            }
                                            onToggle={() =>
                                                handlePriorityToggle(
                                                    option.value
                                                )
                                            }
                                        />
                                    ))}
                                </div>
                            </div>

                            {/* Plan 51: Energy Filters */}
                            <div>
                                <div className="text-xs text-gray-500 dark:text-gray-400 mb-1.5">
                                    {t('search.energyFilter', 'Energy')}
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {energyOptions.map((option) => (
                                        <FilterBadge
                                            key={option.value}
                                            name={t(option.labelKey, option.fallback)}
                                            isSelected={
                                                selectedEnergy === option.value
                                            }
                                            onToggle={() =>
                                                handleEnergyToggle(option.value)
                                            }
                                        />
                                    ))}
                                </div>
                            </div>

                            {/* Plan 52: Time-available Filters */}
                            <div>
                                <div className="text-xs text-gray-500 dark:text-gray-400 mb-1.5">
                                    {t('search.timeFilter', 'Time available')}
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {timeOptions.map((option) => (
                                        <FilterBadge
                                            key={option.value}
                                            name={t(option.labelKey, option.fallback)}
                                            isSelected={
                                                selectedTimeMax === option.value
                                            }
                                            onToggle={() =>
                                                handleTimeMaxToggle(option.value)
                                            }
                                        />
                                    ))}
                                </div>
                            </div>

                            {/* Due Date Filters */}
                            <div>
                                <div className="text-xs text-gray-500 dark:text-gray-400 mb-1.5">
                                    {t('search.dueFilter', 'Due')}
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {dueOptions.map((option) => (
                                        <FilterBadge
                                            key={option.value}
                                            name={t(option.labelKey, option.fallback)}
                                            isSelected={
                                                selectedDue === option.value
                                            }
                                            onToggle={() =>
                                                handleDueToggle(option.value)
                                            }
                                        />
                                    ))}
                                </div>
                                {/* Plan 58: custom due-date range */}
                                <div className="mt-2 flex items-center gap-2 flex-wrap">
                                    <span className="text-xs text-gray-500 dark:text-gray-400">
                                        {t('search.customRange', 'Custom range')}:
                                    </span>
                                    <input
                                        type="date"
                                        value={dueFrom || ''}
                                        onChange={(e) =>
                                            setDueFrom(e.target.value || null)
                                        }
                                        className="text-xs border border-gray-300 dark:border-gray-600 rounded px-1 py-0.5 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                                    />
                                    <span className="text-xs text-gray-400">→</span>
                                    <input
                                        type="date"
                                        value={dueTo || ''}
                                        onChange={(e) =>
                                            setDueTo(e.target.value || null)
                                        }
                                        className="text-xs border border-gray-300 dark:border-gray-600 rounded px-1 py-0.5 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                                    />
                                    {(dueFrom || dueTo) && (
                                        <button
                                            onClick={() => {
                                                setDueFrom(null);
                                                setDueTo(null);
                                            }}
                                            className="text-xs text-red-500 hover:text-red-700"
                                            aria-label={t('common.clear', 'Clear')}
                                        >
                                            ✕
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Defer Until Filters */}
                            <div>
                                <div className="text-xs text-gray-500 dark:text-gray-400 mb-1.5">
                                    {t('search.deferUntilFilter', 'Defer Until')}
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {deferOptions.map((option) => (
                                        <FilterBadge
                                            key={option.value}
                                            name={t(option.labelKey, option.fallback)}
                                            isSelected={
                                                selectedDefer === option.value
                                            }
                                            onToggle={() =>
                                                handleDeferToggle(option.value)
                                            }
                                        />
                                    ))}
                                </div>
                            </div>

                            {/* Tags Filters */}
                            {availableTags.length > 0 && (
                                <div>
                                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-1.5">
                                        {t('search.tagsFilter', 'Tags')}{' '}
                                        <span className="text-gray-400">
                                            (
                                            {t(
                                                'search.allOfThese',
                                                'all of these'
                                            )}
                                            )
                                        </span>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {availableTags.map((tag) => (
                                            <FilterBadge
                                                key={tag.id}
                                                name={tag.name}
                                                color="bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200"
                                                isSelected={selectedTags.includes(
                                                    tag.name
                                                )}
                                                onToggle={() =>
                                                    handleTagToggle(tag.name)
                                                }
                                            />
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Tags (any) Filters — Plan 57 OR semantics */}
                            {availableTags.length > 0 && (
                                <div>
                                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-1.5">
                                        {t('search.tagsAny', 'Tags (any)')}{' '}
                                        <span className="text-gray-400">
                                            (
                                            {t(
                                                'search.anyOfThese',
                                                'any of these'
                                            )}
                                            )
                                        </span>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {availableTags.map((tag) => (
                                            <FilterBadge
                                                key={`any-${tag.id}`}
                                                name={tag.name}
                                                color="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                                                isSelected={selectedTagsAny.includes(
                                                    tag.name
                                                )}
                                                onToggle={() =>
                                                    handleTagAnyToggle(tag.name)
                                                }
                                            />
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Divider */}
                        <div className="my-4 border-t border-gray-300 dark:border-gray-600"></div>

                        {/* Extras Section */}
                        <div className="space-y-3">
                            <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">
                                {t('search.extras', 'Extras')}
                            </div>

                            {/* Extras Filters */}
                            <div className="flex flex-wrap gap-2">
                                {extrasOptions.map((option) => (
                                    <FilterBadge
                                        key={option.value}
                                        name={t(option.labelKey, option.fallback)}
                                        color="bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200"
                                        isSelected={selectedExtras.includes(
                                            option.value
                                        )}
                                        onToggle={() =>
                                            handleExtrasToggle(option.value)
                                        }
                                    />
                                ))}
                            </div>
                        </div>

                        {/* Save as Smart View Section */}
                        {hasActiveFilters && (
                            <div className="mt-4 pt-4 border-t border-gray-300 dark:border-gray-600">
                                {!showSaveForm ? (
                                    <button
                                        onClick={() => setShowSaveForm(true)}
                                        className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
                                    >
                                        <BookmarkIcon className="h-4 w-4" />
                                        <span>
                                            {t('search.saveAsSmartView', 'Save as Smart View')}
                                        </span>
                                    </button>
                                ) : (
                                    <div className="space-y-3">
                                        <div>
                                            <label
                                                htmlFor="viewName"
                                                className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2"
                                            >
                                                {t('search.viewName', 'View Name')}{' '}
                                                <span className="text-red-500">
                                                    *
                                                </span>
                                            </label>
                                            <input
                                                type="text"
                                                id="viewName"
                                                value={viewName}
                                                onChange={(e) => {
                                                    setViewName(e.target.value);
                                                    setSaveError('');
                                                }}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') {
                                                        handleSaveView();
                                                    } else if (
                                                        e.key === 'Escape'
                                                    ) {
                                                        handleCancelSave();
                                                    }
                                                }}
                                                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                placeholder={t(
                                                    'search.viewNamePlaceholder',
                                                    'Enter view name'
                                                )}
                                                autoFocus
                                            />
                                            {saveError && (
                                                <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                                                    {saveError}
                                                </p>
                                            )}
                                        </div>

                                        <div className="flex gap-2 justify-end">
                                            <button
                                                type="button"
                                                onClick={handleCancelSave}
                                                className="px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
                                            >
                                                {t('search.cancel', 'Cancel')}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={handleSaveView}
                                                disabled={isSaving}
                                                className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 rounded-md transition-colors"
                                            >
                                                {isSaving
                                                    ? t('search.saving', 'Saving...')
                                                    : t('search.saveView', 'Save View')}
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Search Results */}
            <SearchResults
                searchQuery={searchQuery}
                selectedFilters={selectedFilters}
                selectedPriority={selectedPriority}
                selectedEnergy={selectedEnergy}
                selectedTimeMax={selectedTimeMax}
                selectedDue={selectedDue}
                dueFrom={dueFrom}
                dueTo={dueTo}
                selectedDefer={selectedDefer}
                selectedTags={selectedTags}
                selectedTagsAny={selectedTagsAny}
                selectedExtras={selectedExtras}
                onClose={onClose}
            />
        </div>
    );
};

export default SearchMenu;
