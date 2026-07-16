import React from 'react';
import { Link } from 'react-router-dom';
import { useBranding } from '../../contexts/BrandingContext';

interface SidebarHeaderProps {
    isDarkMode: boolean;
}

const SidebarHeader: React.FC<SidebarHeaderProps> = ({ isDarkMode }) => {
    const { appName, getLogoSrc } = useBranding();
    return (
        <div className="flex justify-center mb-6 mt-2">
            <Link
                to="/"
                className="flex justify-center items-center mb-2 no-underline"
            >
                <img
                    src={getLogoSrc(isDarkMode)}
                    alt={appName}
                    className="h-12 w-auto"
                />
            </Link>
        </div>
    );
};

export default SidebarHeader;
