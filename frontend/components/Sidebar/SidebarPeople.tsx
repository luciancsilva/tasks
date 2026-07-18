import React from 'react';
import { Location } from 'react-router-dom';
import { UserGroupIcon, PlusCircleIcon } from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';

interface SidebarPeopleProps {
    handleNavClick: (path: string, title: string, icon: JSX.Element) => void;
    location: Location;
    openPersonModal: () => void;
}

const SidebarPeople: React.FC<SidebarPeopleProps> = ({ handleNavClick, location, openPersonModal }) => {
    const { t } = useTranslation();
    const isActive = () =>
        location.pathname.startsWith('/people') || location.pathname.startsWith('/person/')
            ? 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white'
            : 'text-gray-700 dark:text-gray-300';

    return (
        <ul className="flex flex-col space-y-1">
            <li
                className={`flex justify-between items-center rounded-md px-4 py-2 uppercase text-xs tracking-wider cursor-pointer hover:text-black dark:hover:text-white ${isActive()}`}
                onClick={() =>
                    handleNavClick(
                        '/people',
                        t('people.title', 'People'),
                        <UserGroupIcon className="h-5 w-5 mr-2" />
                    )
                }
            >
                <span className="flex items-center">
                    <UserGroupIcon className="h-5 w-5 mr-2" />
                    {t('sidebar.people', 'PEOPLE')}
                </span>
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        openPersonModal();
                    }}
                    className="text-gray-700 dark:text-gray-300 hover:text-black dark:hover:text-white focus:outline-none"
                    aria-label={t('sidebar.addPersonAriaLabel', 'Add Person')}
                    title={t('sidebar.addPersonTitle', 'Add Person')}
                >
                    <PlusCircleIcon className="h-5 w-5" />
                </button>
            </li>
        </ul>
    );
};

export default SidebarPeople;
