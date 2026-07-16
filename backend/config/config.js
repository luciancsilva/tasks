const path = require('path');

if (
    process.env.NODE_ENV !== 'production' &&
    process.env.NODE_ENV !== 'development' &&
    process.env.NODE_ENV !== 'test'
) {
    console.error(
        "NODE_ENV should be one of 'production', 'development' or 'test'."
    );
    process.exit(1);
}

const environment = process.env.NODE_ENV;
const production = process.env.NODE_ENV === 'production';
const projectRootPath = path.join(__dirname, '..'); // backend root path

const credentials = {
    google: {
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        redirectUri:
            process.env.GOOGLE_REDIRECT_URI ||
            'http://localhost:3002/api/calendar/oauth/callback',
    },
};

const defaultHost = environment === 'test' ? '127.0.0.1' : '0.0.0.0';

const emailConfig = {
    enabled: process.env.ENABLE_EMAIL === 'true',
    smtp: {
        host: process.env.EMAIL_SMTP_HOST,
        port: process.env.EMAIL_SMTP_PORT
            ? parseInt(process.env.EMAIL_SMTP_PORT, 10)
            : 587,
        secure: process.env.EMAIL_SMTP_SECURE === 'true',
        auth: {
            user: process.env.EMAIL_SMTP_USERNAME,
            pass: process.env.EMAIL_SMTP_PASSWORD,
        },
    },
    from: {
        address: process.env.EMAIL_FROM_ADDRESS,
        name: process.env.EMAIL_FROM_NAME || 'Tududi',
    },
};

const registrationConfig = {
    tokenExpiryHours: process.env.REGISTRATION_TOKEN_EXPIRY_HOURS
        ? parseInt(process.env.REGISTRATION_TOKEN_EXPIRY_HOURS, 10)
        : 24,
};

const config = {
    allowedOrigins: process.env.TUDUDI_ALLOWED_ORIGINS
        ? process.env.TUDUDI_ALLOWED_ORIGINS.split(',').map((origin) =>
              origin.trim()
          )
        : [
              'http://localhost:8080',
              'http://localhost:9292',
              'http://127.0.0.1:8080',
              'http://127.0.0.1:9292',
          ],

    dbFile:
        process.env.DB_FILE ||
        path.join(projectRootPath, 'db', `${environment}.sqlite3`),

    disableScheduler: process.env.DISABLE_SCHEDULER === 'true',

    disableTelegram: process.env.DISABLE_TELEGRAM === 'true',

    email: process.env.TUDUDI_USER_EMAIL,

    environment,

    frontendUrl: process.env.FRONTEND_URL || 'http://localhost:8080',

    backendUrl: process.env.BACKEND_URL || 'http://localhost:3002',

    // Some CI/sandbox environments disallow binding to 0.0.0.0, so force
    // loopback for tests unless HOST is explicitly provided.
    host: process.env.HOST || defaultHost,

    port: process.env.PORT || 3002,

    password: process.env.TUDUDI_USER_PASSWORD,

    production,

    secret:
        process.env.TUDUDI_SESSION_SECRET ||
        require('crypto').randomBytes(64).toString('hex'),

    credentials,

    emailConfig,

    registrationConfig,

    uploadPath:
        process.env.TUDUDI_UPLOAD_PATH || path.join(projectRootPath, 'uploads'),

    // File upload limit in MB (default 10MB)
    fileUploadLimitMB: process.env.FILE_UPLOAD_LIMIT_MB
        ? parseInt(process.env.FILE_UPLOAD_LIMIT_MB, 10)
        : 10,

    // Cloudflare R2 (S3-compatible) object storage for attachments/avatars/project images.
    // When enabled, uploads go to R2 instead of the local filesystem (uploadPath).
    //
    // Canonical env var names use the unified CLOUDFLARE_ prefix
    // (CLOUDFLARE_ACCOUNT_ID is shared with the D1 data layer); the legacy
    // R2_* names keep working as fallbacks.
    //
    // All fields are getters so env vars are read at access time (not at module
    // load), which matters because dotenv may populate process.env after this
    // config module is first required (e.g. in the test bootstrap).
    r2: {
        // Storage is considered enabled only when all required credentials are present.
        get enabled() {
            return !!(
                this.accessKeyId &&
                this.secretAccessKey &&
                this.bucket &&
                (this.endpoint || this.accountId)
            );
        },
        get accountId() {
            return (
                process.env.CLOUDFLARE_ACCOUNT_ID || process.env.R2_ACCOUNT_ID
            );
        },
        get accessKeyId() {
            return (
                process.env.CLOUDFLARE_R2_ACCESS_KEY_ID ||
                process.env.R2_ACCESS_KEY_ID
            );
        },
        get secretAccessKey() {
            return (
                process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY ||
                process.env.R2_SECRET_ACCESS_KEY
            );
        },
        // In the test environment the S3 client is fully mocked, so a placeholder
        // bucket lets the multer-s3 storage engine construct without real config.
        get bucket() {
            return (
                process.env.CLOUDFLARE_R2_BUCKET ||
                process.env.R2_BUCKET ||
                (environment === 'test' ? 'tududi-test' : undefined)
            );
        },
        // Explicit endpoint override; falls back to the standard R2 endpoint derived
        // from the account id. region is fixed to 'auto' per Cloudflare R2 docs.
        get endpoint() {
            const explicit =
                process.env.CLOUDFLARE_R2_ENDPOINT || process.env.R2_ENDPOINT;
            if (explicit) {
                return explicit;
            }
            return this.accountId
                ? `https://${this.accountId}.r2.cloudflarestorage.com`
                : undefined;
        },
        get region() {
            return (
                process.env.CLOUDFLARE_R2_REGION ||
                process.env.R2_REGION ||
                'auto'
            );
        },
    },

    // Cloudflare D1 database accessed directly through the REST API
    // (no Worker proxy). Activated explicitly with TUDUDI_DB_DRIVER=d1;
    // otherwise the local SQLite file (dbFile) keeps being used.
    //
    // Getters so env vars are read at access time (same rationale as r2).
    d1: {
        get enabled() {
            return process.env.TUDUDI_DB_DRIVER === 'd1';
        },
        get accountId() {
            return process.env.CLOUDFLARE_ACCOUNT_ID;
        },
        get databaseId() {
            return process.env.CLOUDFLARE_D1_DATABASE_ID;
        },
        get apiToken() {
            return process.env.CLOUDFLARE_API_TOKEN;
        },
        get baseUrl() {
            return (
                process.env.CLOUDFLARE_D1_API_BASE_URL ||
                process.env.D1_API_BASE_URL ||
                undefined
            );
        },
        get timeoutMs() {
            const raw =
                process.env.CLOUDFLARE_D1_TIMEOUT_MS ||
                process.env.D1_TIMEOUT_MS;
            return raw ? parseInt(raw, 10) : undefined;
        },
        get maxRequestsPerWindow() {
            const raw =
                process.env.CLOUDFLARE_D1_MAX_REQUESTS_PER_WINDOW ||
                process.env.D1_MAX_REQUESTS_PER_WINDOW;
            return raw ? parseInt(raw, 10) : undefined;
        },
    },

    // API Documentation (Swagger)
    swagger: {
        enabled: process.env.SWAGGER_ENABLED !== 'false',
    },

    trustProxy: (() => {
        const val = process.env.TUDUDI_TRUST_PROXY;
        if (val === undefined || val === '') {
            console.log('[Config] TUDUDI_TRUST_PROXY not set, using false');
            return false;
        }
        if (val === 'true') {
            console.warn(
                '[Config] TUDUDI_TRUST_PROXY=true is permissive — converting to 1 (single hop). ' +
                    'Set TUDUDI_TRUST_PROXY=1 explicitly to silence this warning, ' +
                    'or use a higher number if you have multiple proxy hops.'
            );
            return 1;
        }
        if (val === 'false') {
            console.log(
                '[Config] TUDUDI_TRUST_PROXY=false parsed as boolean false'
            );
            return false;
        }
        const num = Number(val);
        if (!isNaN(num) && val.trim() !== '') {
            console.log(
                `[Config] TUDUDI_TRUST_PROXY=${val} parsed as number ${num}`
            );
            return num;
        }
        console.log(`[Config] TUDUDI_TRUST_PROXY=${val} parsed as string`);
        return val;
    })(),

    // Encryption key for CalDAV credentials (falls back to SECRET_KEY or session secret)
    encryptionKey: process.env.ENCRYPTION_KEY,

    // Alternative encryption key (for backward compatibility)
    secretKey: process.env.SECRET_KEY,

    // Rate limiting configuration
    rateLimiting: {
        // Disable rate limiting in test environment
        enabled:
            process.env.RATE_LIMITING_ENABLED !== 'false' &&
            environment !== 'test',

        // Authentication endpoints (login, register)
        auth: {
            windowMs:
                parseInt(process.env.RATE_LIMIT_AUTH_WINDOW_MS) ||
                15 * 60 * 1000, // 15 minutes
            max: parseInt(process.env.RATE_LIMIT_AUTH_MAX) || 5, // 5 requests per window
        },

        // General API for unauthenticated requests
        api: {
            windowMs:
                parseInt(process.env.RATE_LIMIT_API_WINDOW_MS) ||
                15 * 60 * 1000, // 15 minutes
            max: parseInt(process.env.RATE_LIMIT_API_MAX) || 100, // 100 requests per window
        },

        // Authenticated API requests
        authenticatedApi: {
            windowMs:
                parseInt(process.env.RATE_LIMIT_AUTH_API_WINDOW_MS) ||
                15 * 60 * 1000, // 15 minutes
            max: parseInt(process.env.RATE_LIMIT_AUTH_API_MAX) || 1000, // 1000 requests per window
        },

        // Resource creation endpoints
        createResource: {
            windowMs:
                parseInt(process.env.RATE_LIMIT_CREATE_WINDOW_MS) ||
                15 * 60 * 1000, // 15 minutes
            max: parseInt(process.env.RATE_LIMIT_CREATE_MAX) || 50, // 50 requests per window
        },

        // API key management endpoints
        apiKeyManagement: {
            windowMs:
                parseInt(process.env.RATE_LIMIT_API_KEY_WINDOW_MS) ||
                60 * 60 * 1000, // 1 hour
            max: parseInt(process.env.RATE_LIMIT_API_KEY_MAX) || 10, // 10 requests per window
        },
    },
};

console.log(`Using database file '${config.dbFile}'`);

function setConfig({ dbFile } = {}) {
    if (dbFile != null) {
        config.dbFile = dbFile;
    }
}

function getConfig() {
    return config;
}

module.exports = { setConfig, getConfig };
