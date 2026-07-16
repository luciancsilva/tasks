import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useState,
} from 'react';
import { getApiPath, getAssetPath } from '../config/paths';

export interface Branding {
    app_name: string | null;
    logo_light: string | null;
    logo_dark: string | null;
    favicon: string | null;
}

export const DEFAULT_APP_NAME = 'tududi';

const DEFAULT_BRANDING: Branding = {
    app_name: null,
    logo_light: null,
    logo_dark: null,
    favicon: null,
};

interface BrandingContextValue {
    branding: Branding;
    /** Display name with fallback to the stock "tududi". */
    appName: string;
    /** Logo URL for the current theme with fallback to the bundled assets. */
    getLogoSrc: (isDarkMode: boolean) => string;
    /** Re-fetch branding from the server (after admin changes). */
    refreshBranding: () => Promise<void>;
}

const BrandingContext = createContext<BrandingContextValue>({
    branding: DEFAULT_BRANDING,
    appName: DEFAULT_APP_NAME,
    getLogoSrc: (isDarkMode: boolean) =>
        getAssetPath(isDarkMode ? 'wide-logo-light.png' : 'wide-logo-dark.png'),
    refreshBranding: async () => {},
});

/** Swap every <link rel="icon"> to the custom favicon (or restore defaults). */
const applyFavicon = (url: string | null) => {
    const links =
        document.querySelectorAll<HTMLLinkElement>('link[rel~="icon"]');
    links.forEach((link) => {
        if (url) {
            if (!link.dataset.defaultHref) {
                link.dataset.defaultHref = link.href;
            }
            link.href = url;
        } else if (link.dataset.defaultHref) {
            link.href = link.dataset.defaultHref;
        }
    });
};

export const BrandingProvider: React.FC<{ children: React.ReactNode }> = ({
    children,
}) => {
    const [branding, setBranding] = useState<Branding>(DEFAULT_BRANDING);

    const refreshBranding = useCallback(async () => {
        try {
            const response = await fetch(getApiPath('branding'), {
                credentials: 'include',
                headers: { Accept: 'application/json' },
            });
            if (response.ok) {
                const data = await response.json();
                setBranding({
                    app_name: data.app_name ?? null,
                    logo_light: data.logo_light ?? null,
                    logo_dark: data.logo_dark ?? null,
                    favicon: data.favicon ?? null,
                });
            }
        } catch {
            // Branding is cosmetic: on failure keep the stock defaults.
        }
    }, []);

    useEffect(() => {
        refreshBranding();
    }, [refreshBranding]);

    useEffect(() => {
        document.title = branding.app_name || DEFAULT_APP_NAME;
        applyFavicon(branding.favicon ? getApiPath(branding.favicon) : null);
    }, [branding]);

    const getLogoSrc = useCallback(
        (isDarkMode: boolean) => {
            const custom = isDarkMode
                ? branding.logo_dark
                : branding.logo_light;
            if (custom) {
                return getApiPath(custom);
            }
            return getAssetPath(
                isDarkMode ? 'wide-logo-light.png' : 'wide-logo-dark.png'
            );
        },
        [branding]
    );

    return (
        <BrandingContext.Provider
            value={{
                branding,
                appName: branding.app_name || DEFAULT_APP_NAME,
                getLogoSrc,
                refreshBranding,
            }}
        >
            {children}
        </BrandingContext.Provider>
    );
};

export const useBranding = () => useContext(BrandingContext);
