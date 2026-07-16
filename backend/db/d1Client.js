'use strict';

/**
 * Thin HTTP client for the Cloudflare D1 REST API.
 *
 * Sends SQL statements to
 *   POST /accounts/{account_id}/d1/database/{database_id}/query
 * authenticated with an API token. Handles timeouts, response parsing,
 * retries with exponential backoff for transient failures (HTTP 429/5xx,
 * network errors) and a local sliding-window rate limiter to stay under
 * Cloudflare's global API budget of 1200 requests / 5 minutes per account.
 */

const DEFAULT_BASE_URL = 'https://api.cloudflare.com/client/v4';
const DEFAULT_TIMEOUT_MS = 30000;
// Cloudflare's account-wide budget is 1200 req / 5 min; keep a margin for
// other API consumers on the same account.
const DEFAULT_MAX_REQUESTS_PER_WINDOW = 1100;
const DEFAULT_WINDOW_MS = 5 * 60 * 1000;
const MAX_RETRIES = 3;

class D1Error extends Error {
    constructor(message, { status, errors } = {}) {
        super(message);
        this.name = 'D1Error';
        this.status = status;
        this.errors = errors || [];
        // Sequelize's sqlite dialect inspects err.code / message content to
        // classify constraint violations; surface the SQLITE_* token when
        // the D1 error message carries one.
        const match = /SQLITE_[A-Z_]+/.exec(message);
        if (match) {
            this.code = match[0];
        }
    }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

class D1Client {
    constructor({
        accountId,
        databaseId,
        apiToken,
        baseUrl = DEFAULT_BASE_URL,
        timeoutMs = DEFAULT_TIMEOUT_MS,
        maxRequestsPerWindow = DEFAULT_MAX_REQUESTS_PER_WINDOW,
        windowMs = DEFAULT_WINDOW_MS,
        fetchImpl,
    } = {}) {
        if (!accountId || !databaseId || !apiToken) {
            throw new D1Error(
                'D1 is not configured: set CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_D1_DATABASE_ID and CLOUDFLARE_API_TOKEN'
            );
        }
        this.url = `${baseUrl}/accounts/${accountId}/d1/database/${databaseId}/query`;
        this.apiToken = apiToken;
        this.timeoutMs = timeoutMs;
        this.maxRequestsPerWindow = maxRequestsPerWindow;
        this.windowMs = windowMs;
        this._fetch = fetchImpl || global.fetch;
        this._requestTimestamps = [];
    }

    /**
     * Wait (if needed) for a slot in the local sliding rate-limit window.
     */
    async _acquireSlot() {
        for (;;) {
            const now = Date.now();
            this._requestTimestamps = this._requestTimestamps.filter(
                (ts) => now - ts < this.windowMs
            );
            if (this._requestTimestamps.length < this.maxRequestsPerWindow) {
                this._requestTimestamps.push(now);
                return;
            }
            const oldest = this._requestTimestamps[0];
            await sleep(Math.max(oldest + this.windowMs - now, 25));
        }
    }

    async _postOnce(body) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), this.timeoutMs);
        try {
            return await this._fetch(this.url, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${this.apiToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(body),
                signal: controller.signal,
            });
        } finally {
            clearTimeout(timer);
        }
    }

    /**
     * Execute a SQL statement against D1.
     *
     * @param {string} sql      SQL text (may contain several ;-separated statements).
     * @param {Array}  [params] Ordered bind parameters for `?` placeholders.
     * @returns {Promise<{results: Array<object>, meta: object}>} first result set.
     */
    async query(sql, params = []) {
        const body = { sql, params };
        let lastError;

        for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
            if (attempt > 0) {
                // 250ms, 500ms, 1s (+ jitter)
                await sleep(250 * 2 ** (attempt - 1) + Math.random() * 100);
            }
            await this._acquireSlot();

            let response;
            try {
                response = await this._postOnce(body);
            } catch (err) {
                // Network failure / timeout: retry.
                lastError = new D1Error(
                    `D1 request failed: ${err.message}`,
                    {}
                );
                continue;
            }

            if (response.status === 429 || response.status >= 500) {
                lastError = new D1Error(
                    `D1 request failed with HTTP ${response.status}`,
                    { status: response.status }
                );
                continue;
            }

            let payload;
            try {
                payload = await response.json();
            } catch (err) {
                lastError = new D1Error(
                    `D1 returned an unparsable response (HTTP ${response.status})`,
                    { status: response.status }
                );
                continue;
            }

            if (!response.ok || payload.success === false) {
                const messages = (payload.errors || [])
                    .map((e) => e.message)
                    .filter(Boolean);
                // Client errors (4xx) are not retryable: bad SQL stays bad.
                throw new D1Error(
                    messages.join('; ') ||
                        `D1 request failed with HTTP ${response.status}`,
                    { status: response.status, errors: payload.errors }
                );
            }

            const first = Array.isArray(payload.result)
                ? payload.result[0]
                : undefined;
            return {
                results: (first && first.results) || [],
                meta: (first && first.meta) || {},
            };
        }

        throw lastError;
    }
}

module.exports = { D1Client, D1Error };
