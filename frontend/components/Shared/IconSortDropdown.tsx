import React, { ReactNode, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ListBulletIcon, CheckIcon } from '@heroicons/react/24/outline';
import { SortOption } from './SortFilterButton';

interface IconSortDropdownProps {
    options: SortOption[];
    value: string;
    onChange: (value: string) => void;
    ariaLabel?: string;
    title?: string;
    className?: string;
    buttonClassName?: string;
    dropdownLabel?: string;
    align?: 'left' | 'right';
    extraContent?: ReactNode;
    footerContent?: ReactNode;
}

const IconSortDropdown: React.FC<IconSortDropdownProps> = ({
    options,
    value,
    onChange,
    ariaLabel,
    title,
    className = '',
    buttonClassName = '',
    dropdownLabel,
    align = 'right',
    extraContent,
    footerContent,
}) => {
    const { t } = useTranslation();
    const resolvedAriaLabel = ariaLabel ?? t('common.sortItems');
    const resolvedTitle = title ?? t('common.sortItems');
    const resolvedDropdownLabel =
        dropdownLabel === undefined ? t('common.sortBy') : dropdownLabel;
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!isOpen) {
            return;
        }

        const handleClickOutside = (event: MouseEvent) => {
            if (
                dropdownRef.current &&
                !dropdownRef.current.contains(event.target as Node)
            ) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () =>
            document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    return (
        <div className={`relative ${className}`} ref={dropdownRef}>
            <button
                type="button"
                onClick={() => setIsOpen((prev) => !prev)}
                className={`p-1.5 sm:p-2 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 focus:outline-none transition-colors ${buttonClassName}`}
                aria-label={resolvedAriaLabel}
                title={resolvedTitle}
            >
                <ListBulletIcon className="h-4 w-4 sm:h-5 sm:w-5" />
            </button>
            {isOpen && (
                <div
                    className={`absolute ${align === 'left' ? 'left-0' : 'right-0'} mt-1 w-56 bg-white dark:bg-gray-800 rounded-md shadow-lg border border-gray-200 dark:border-gray-700 z-50`}
                >
                    {resolvedDropdownLabel && (
                        <div className="px-3 py-2 text-xs font-bold text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
                            {resolvedDropdownLabel}
                        </div>
                    )}
                    <div className="py-1">
                        {options.map((option) => (
                            <button
                                key={option.value}
                                onClick={() => {
                                    onChange(option.value);
                                    setIsOpen(false);
                                }}
                                className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                                    value === option.value
                                        ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                                }`}
                            >
                                <span className="flex items-center justify-between">
                                    <span>{option.label}</span>
                                    {value === option.value && (
                                        <CheckIcon className="h-4 w-4" />
                                    )}
                                </span>
                            </button>
                        ))}
                    </div>
                    {extraContent && (
                        <div className="border-t border-gray-200 dark:border-gray-700">
                            {extraContent}
                        </div>
                    )}
                    {footerContent && (
                        <div className="border-t border-gray-200 dark:border-gray-700">
                            {footerContent}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default IconSortDropdown;
