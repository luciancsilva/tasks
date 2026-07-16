const fs = require('fs');
const path = require('path');

const localesDir = path.join(__dirname, '../public/locales');
const enPath = path.join(localesDir, 'en/translation.json');

if (!fs.existsSync(enPath)) {
    console.error('English translation file not found at:', enPath);
    process.exit(1);
}

const enTranslations = JSON.parse(fs.readFileSync(enPath, 'utf8'));

function getFlatKeys(obj, prefix = '') {
    let keys = [];
    for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            const fullKey = prefix ? `${prefix}.${key}` : key;
            if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
                keys = keys.concat(getFlatKeys(obj[key], fullKey));
            } else {
                keys.push(fullKey);
            }
        }
    }
    return keys;
}

const enKeys = new Set(getFlatKeys(enTranslations));
let hasDrift = false;

const locales = fs.readdirSync(localesDir).filter(f => {
    const fullPath = path.join(localesDir, f);
    return fs.statSync(fullPath).isDirectory() && f !== 'en';
});

console.log(`Checking ${locales.length} locales against 'en'...`);

for (const locale of locales) {
    const localePath = path.join(localesDir, locale, 'translation.json');
    if (!fs.existsSync(localePath)) {
        console.error(`[FAIL] ${locale}: translation.json missing`);
        hasDrift = true;
        continue;
    }

    try {
        const translations = JSON.parse(fs.readFileSync(localePath, 'utf8'));
        const localeKeys = new Set(getFlatKeys(translations));

        const missing = [...enKeys].filter(k => !localeKeys.has(k));
        if (missing.length > 0) {
            console.error(`[FAIL] ${locale}: missing ${missing.length} keys:`);
            missing.forEach(k => console.error(`  - ${k}`));
            hasDrift = true;
        } else {
            console.log(`[OK] ${locale}`);
        }
    } catch (err) {
        console.error(`[FAIL] ${locale}: failed to parse JSON (${err.message})`);
        hasDrift = true;
    }
}

if (hasDrift) {
    console.error('\ni18n check failed: translation drift detected!');
    process.exit(1);
} else {
    console.log('\ni18n check passed: all locales are in sync.');
    process.exit(0);
}
