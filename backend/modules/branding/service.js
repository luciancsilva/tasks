'use strict';

/**
 * Instance-wide branding (custom app name, logos, favicon).
 *
 * Values live in the global key/value `settings` table (same mechanism as
 * `registration_enabled`) because branding must be readable pre-login
 * (Login/Register pages) and is shared by every user of the instance.
 *
 * Asset settings store the public URL (`/api/branding/asset/<filename>`);
 * the corresponding R2 object key is `branding/<filename>`.
 */

const { Setting } = require('../../models');
const r2Service = require('../../services/r2Service');

const ASSET_KINDS = ['logo_light', 'logo_dark', 'favicon'];

const SETTING_KEYS = {
    app_name: 'branding_app_name',
    logo_light: 'branding_logo_light',
    logo_dark: 'branding_logo_dark',
    favicon: 'branding_favicon',
};

const ASSET_URL_PREFIX = '/api/branding/asset/';

function isAssetKind(kind) {
    return ASSET_KINDS.includes(kind);
}

/**
 * Extract the R2 object key from a stored branding asset URL.
 * Returns null for anything that does not point at the branding asset route.
 */
function assetUrlToObjectKey(url) {
    if (!url || typeof url !== 'string') {
        return null;
    }
    if (!url.startsWith(ASSET_URL_PREFIX)) {
        return null;
    }
    const filename = url.slice(ASSET_URL_PREFIX.length);
    if (!filename || filename.includes('/') || filename.includes('..')) {
        return null;
    }
    return `branding/${filename}`;
}

async function getSettingValue(key) {
    const setting = await Setting.findOne({ where: { key } });
    return setting && setting.value !== '' ? setting.value : null;
}

async function setSettingValue(key, value) {
    if (value === null || value === undefined || value === '') {
        await Setting.destroy({ where: { key } });
        return;
    }
    await Setting.upsert({ key, value: String(value) });
}

/**
 * Current branding configuration. Every field is null when not customized,
 * which tells the frontend to fall back to the stock tududi branding.
 */
async function getBranding() {
    const settings = await Setting.findAll({
        where: { key: Object.values(SETTING_KEYS) },
    });
    const byKey = {};
    for (const setting of settings) {
        byKey[setting.key] = setting.value;
    }
    return {
        app_name: byKey[SETTING_KEYS.app_name] || null,
        logo_light: byKey[SETTING_KEYS.logo_light] || null,
        logo_dark: byKey[SETTING_KEYS.logo_dark] || null,
        favicon: byKey[SETTING_KEYS.favicon] || null,
    };
}

/**
 * Set (or clear, with null/'') the custom application name.
 */
async function setAppName(appName) {
    const value =
        appName === null || appName === undefined ? '' : String(appName).trim();
    if (value.length > 100) {
        const error = new Error(
            'Application name must be at most 100 characters'
        );
        error.status = 400;
        throw error;
    }
    await setSettingValue(SETTING_KEYS.app_name, value);
    return getBranding();
}

/**
 * Point a branding asset at a freshly uploaded R2 object key
 * (e.g. 'branding/logo_light-123.png'), deleting the previous object.
 */
async function setAsset(kind, objectKey) {
    const previousUrl = await getSettingValue(SETTING_KEYS[kind]);
    const filename = objectKey.split('/').pop();
    await setSettingValue(SETTING_KEYS[kind], `${ASSET_URL_PREFIX}${filename}`);

    const previousKey = assetUrlToObjectKey(previousUrl);
    if (previousKey && previousKey !== objectKey) {
        await r2Service.deleteObject(previousKey);
    }
    return getBranding();
}

/**
 * Clear a branding asset and delete its R2 object (best-effort).
 */
async function clearAsset(kind) {
    const previousUrl = await getSettingValue(SETTING_KEYS[kind]);
    await setSettingValue(SETTING_KEYS[kind], '');

    const previousKey = assetUrlToObjectKey(previousUrl);
    if (previousKey) {
        await r2Service.deleteObject(previousKey);
    }
    return getBranding();
}

module.exports = {
    ASSET_KINDS,
    SETTING_KEYS,
    isAssetKind,
    assetUrlToObjectKey,
    getBranding,
    setAppName,
    setAsset,
    clearAsset,
};
