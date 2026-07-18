import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PaintBrushIcon } from '@heroicons/react/24/outline';
import { getApiPath } from '../../../config/paths';
import { fetchWithCsrf } from '../../../utils/csrfService';
import { useBranding } from '../../../contexts/BrandingContext';
import { useToast } from '../../Shared/ToastContext';

interface BrandingTabProps {
    isActive: boolean;
}

type AssetKind = 'logo_light' | 'logo_dark' | 'favicon';

const BrandingTab: React.FC<BrandingTabProps> = ({ isActive }) => {
    const { t } = useTranslation();
    const { branding, refreshBranding } = useBranding();
    const { showSuccessToast, showErrorToast } = useToast();

    const [appNameInput, setAppNameInput] = useState(branding.app_name || '');
    const [busy, setBusy] = useState(false);
    const fileInputs: Record<
        AssetKind,
        React.RefObject<HTMLInputElement | null>
    > = {
        logo_light: useRef<HTMLInputElement>(null),
        logo_dark: useRef<HTMLInputElement>(null),
        favicon: useRef<HTMLInputElement>(null),
    };

    useEffect(() => {
        setAppNameInput(branding.app_name || '');
    }, [branding.app_name]);

    if (!isActive) return null;

    const saveAppName = async () => {
        setBusy(true);
        try {
            const response = await fetchWithCsrf(getApiPath('branding'), {
                method: 'PUT',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ app_name: appNameInput.trim() }),
            });
            if (!response.ok) {
                throw new Error('save failed');
            }
            await refreshBranding();
            showSuccessToast(
                t('profile.branding.saved', 'Branding updated successfully')
            );
        } catch {
            showErrorToast(
                t('profile.branding.saveError', 'Failed to update branding')
            );
        } finally {
            setBusy(false);
        }
    };

    const uploadAsset = async (kind: AssetKind, file: File) => {
        setBusy(true);
        try {
            const formData = new FormData();
            formData.append('file', file);
            const response = await fetchWithCsrf(
                getApiPath(`branding/asset/${kind}`),
                {
                    method: 'POST',
                    credentials: 'include',
                    body: formData,
                }
            );
            if (!response.ok) {
                throw new Error('upload failed');
            }
            await refreshBranding();
            showSuccessToast(
                t('profile.branding.saved', 'Branding updated successfully')
            );
        } catch {
            showErrorToast(
                t('profile.branding.uploadError', 'Failed to upload image')
            );
        } finally {
            setBusy(false);
        }
    };

    const removeAsset = async (kind: AssetKind) => {
        setBusy(true);
        try {
            const response = await fetchWithCsrf(
                getApiPath(`branding/asset/${kind}`),
                {
                    method: 'DELETE',
                    credentials: 'include',
                }
            );
            if (!response.ok) {
                throw new Error('remove failed');
            }
            await refreshBranding();
            showSuccessToast(
                t('profile.branding.saved', 'Branding updated successfully')
            );
        } catch {
            showErrorToast(
                t('profile.branding.saveError', 'Failed to update branding')
            );
        } finally {
            setBusy(false);
        }
    };

    const assetRows: { kind: AssetKind; label: string }[] = [
        {
            kind: 'logo_light',
            label: t('profile.branding.logoLight', 'Logo (light theme)'),
        },
        {
            kind: 'logo_dark',
            label: t('profile.branding.logoDark', 'Logo (dark theme)'),
        },
        {
            kind: 'favicon',
            label: t('profile.branding.favicon', 'Favicon'),
        },
    ];

    const restoreDefaults = async () => {
        if (
            !window.confirm(
                t(
                    'profile.branding.restoreConfirm',
                    'Are you sure you want to restore the default branding? This will remove custom logos, favicon, and app name.'
                )
            )
        ) {
            return;
        }
        setBusy(true);
        try {
            const nameResponse = await fetchWithCsrf(getApiPath('branding'), {
                method: 'PUT',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ app_name: '' }),
            });
            if (!nameResponse.ok) throw new Error('save name failed');

            for (const { kind } of assetRows) {
                if (branding[kind]) {
                    const response = await fetchWithCsrf(
                        getApiPath(`branding/asset/${kind}`),
                        {
                            method: 'DELETE',
                            credentials: 'include',
                        }
                    );
                    if (!response.ok) throw new Error(`remove ${kind} failed`);
                }
            }

            await refreshBranding();
            showSuccessToast(
                t('profile.branding.saved', 'Branding updated successfully')
            );
        } catch {
            showErrorToast(
                t('profile.branding.saveError', 'Failed to update branding')
            );
        } finally {
            setBusy(false);
        }
    };



    return (
        <div className="space-y-8">
            <div>
                <h3 className="flex items-center text-lg font-medium text-gray-900 dark:text-white mb-2">
                    <PaintBrushIcon className="w-5 h-5 mr-2" />
                    {t('profile.branding.title', 'Branding')}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                    {t(
                        'profile.branding.description',
                        'Customize the displayed application name, logos and favicon for this instance. Leave empty to use the default tududi branding.'
                    )}
                </p>
            </div>

            <div>
                <label
                    htmlFor="branding-app-name"
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                >
                    {t('profile.branding.appName', 'Application name')}
                </label>
                <div className="flex gap-2">
                    <input
                        id="branding-app-name"
                        type="text"
                        maxLength={100}
                        value={appNameInput}
                        onChange={(e) => setAppNameInput(e.target.value)}
                        placeholder={t(
                            'profile.branding.appNamePlaceholder',
                            'tududi'
                        )}
                        className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:text-white"
                    />
                    <button
                        type="button"
                        onClick={saveAppName}
                        disabled={busy}
                        className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50"
                    >
                        {t('profile.branding.save', 'Save')}
                    </button>
                    <button
                        type="button"
                        onClick={restoreDefaults}
                        disabled={busy || (!branding.app_name && !branding.logo_light && !branding.logo_dark && !branding.favicon)}
                        className="px-4 py-2 bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-200 text-sm font-medium rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50"
                    >
                        {t('profile.branding.restore', 'Restore defaults')}
                    </button>
                </div>
            </div>

            {assetRows.map(({ kind, label }) => {
                const currentUrl = branding[kind];
                return (
                    <div key={kind}>
                        <span className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            {label}
                        </span>
                        <div className="flex items-center gap-3">
                            <div
                                className={`flex items-center justify-center h-12 min-w-[3rem] px-2 rounded border border-dashed border-gray-300 dark:border-gray-600 ${
                                    kind === 'logo_dark'
                                        ? 'bg-gray-800'
                                        : 'bg-gray-50 dark:bg-gray-800'
                                }`}
                            >
                                {currentUrl ? (
                                    <img
                                        src={getApiPath(currentUrl)}
                                        alt={label}
                                        className="max-h-10 w-auto"
                                    />
                                ) : (
                                    <span className="text-xs text-gray-400">
                                        {t(
                                            'profile.branding.default',
                                            'Default'
                                        )}
                                    </span>
                                )}
                            </div>
                            <input
                                ref={fileInputs[kind]}
                                type="file"
                                accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml,image/x-icon,image/vnd.microsoft.icon"
                                className="hidden"
                                onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                        const checkDims = async () => {
                                            if (file.type !== 'image/svg+xml') {
                                                const img = new window.Image();
                                                const url = URL.createObjectURL(file);
                                                img.src = url;
                                                await new Promise((resolve) => {
                                                    img.onload = resolve;
                                                    img.onerror = resolve;
                                                });
                                                URL.revokeObjectURL(url);

                                                if (img.width || img.height) {
                                                    let isOff = false;
                                                    if (kind === 'favicon' && (img.width > 256 || img.height > 256 || img.width !== img.height)) {
                                                        isOff = true;
                                                    } else if (kind.startsWith('logo_') && (img.height > 200 || img.width > 1000)) {
                                                        isOff = true;
                                                    }
                                                    if (isOff) {
                                                        if (!window.confirm(t('profile.branding.dimensionWarning', 'Image dimensions are different from recommended. Continue anyway?'))) {
                                                            return;
                                                        }
                                                    }
                                                }
                                            }
                                            uploadAsset(kind, file);
                                        };
                                        checkDims();
                                    }
                                    e.target.value = '';
                                }}
                            />
                            <button
                                type="button"
                                disabled={busy}
                                onClick={() =>
                                    fileInputs[kind].current?.click()
                                }
                                className="px-3 py-2 text-sm font-medium border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
                            >
                                {t('profile.branding.upload', 'Upload')}
                            </button>
                            {currentUrl && (
                                <button
                                    type="button"
                                    disabled={busy}
                                    onClick={() => removeAsset(kind)}
                                    className="px-3 py-2 text-sm font-medium text-red-600 dark:text-red-400 hover:underline disabled:opacity-50"
                                >
                                    {t('profile.branding.remove', 'Remove')}
                                </button>
                            )}
                        </div>
                    </div>
                );
            })}

            <p className="text-xs text-gray-500 dark:text-gray-400">
                {t(
                    'profile.branding.assetHelp',
                    'PNG, JPG, GIF, WebP, SVG or ICO, up to 2 MB. Recommended: wide logo around 300x72px, square favicon 32x32px.'
                )}
            </p>
        </div>
    );
};

export default BrandingTab;
