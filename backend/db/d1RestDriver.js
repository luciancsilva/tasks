'use strict';

/**
 * sqlite3-compatible driver that executes every statement against Cloudflare
 * D1 via its REST API.
 *
 * Sequelize's sqlite dialect accepts any module implementing the `sqlite3`
 * interface through the `dialectModule` option. This driver implements the
 * exact surface Sequelize (and this app) uses — `Database`, `run`, `all`,
 * `get`, `exec`, `serialize`, `close`, and the OPEN_* constants — so the
 * whole Sequelize layer (models, associations, migrations, raw queries)
 * keeps working unchanged while the data lives in D1.
 *
 * Known, deliberate semantic differences (documented in plans/04-d1-migration.md):
 * - The REST API is stateless: BEGIN/COMMIT/ROLLBACK/SAVEPOINT have no
 *   session to live in and are treated as successful no-ops. Multi-statement
 *   flows lose atomicity; each individual request is still atomic.
 * - `PRAGMA foreign_keys = OFF/ON` is mapped to `PRAGMA defer_foreign_keys`,
 *   which D1 supports (per-request scope).
 * - Local-performance PRAGMAs (journal_mode, synchronous, busy_timeout,
 *   cache_size, temp_store, mmap_size) are no-ops.
 */

const { D1Client } = require('./d1Client');
const { getConfig } = require('../config/config');

// Constant values mirror the `sqlite3` package.
const OPEN_READONLY = 0x00000001;
const OPEN_READWRITE = 0x00000002;
const OPEN_CREATE = 0x00000004;
const OPEN_URI = 0x00000040;
const OPEN_SHAREDCACHE = 0x00020000;
const OPEN_PRIVATECACHE = 0x00040000;
const OPEN_FULLMUTEX = 0x00010000;

const NOOP_STATEMENTS = [
    /^BEGIN\b/i,
    /^COMMIT\b/i,
    /^END\s+TRANSACTION\b/i,
    /^ROLLBACK\b/i,
    /^SAVEPOINT\b/i,
    /^RELEASE\b/i,
];

const NOOP_PRAGMAS =
    /^PRAGMA\s+(journal_mode|synchronous|busy_timeout|cache_size|temp_store|mmap_size|key)\b/i;

/**
 * Rewrite or drop statements that cannot run over the stateless REST API.
 * Returns null when the statement must be treated as a successful no-op.
 */
function translateStatement(sql) {
    const trimmed = sql.trim();

    for (const pattern of NOOP_STATEMENTS) {
        if (pattern.test(trimmed)) {
            return null;
        }
    }

    if (NOOP_PRAGMAS.test(trimmed)) {
        return null;
    }

    const fk = /^PRAGMA\s+foreign_keys\s*=\s*(\w+)/i.exec(trimmed);
    if (fk) {
        const value = fk[1].toUpperCase();
        const off = value === 'OFF' || value === '0' || value === 'FALSE';
        // Enforcement is always on in D1; deferral is the supported switch.
        return off
            ? 'PRAGMA defer_foreign_keys = true'
            : 'PRAGMA defer_foreign_keys = false';
    }

    // D1 validates pragma names against its allowlist CASE-SENSITIVELY:
    // `PRAGMA index_list(t)` works while `PRAGMA INDEX_LIST(t)` fails with
    // SQLITE_AUTH. Sequelize emits uppercase pragma names (TABLE_INFO,
    // INDEX_LIST, INDEX_INFO), so lowercase the pragma keyword.
    const pragma = /^(PRAGMA\s+)([A-Za-z_]+)/i.exec(trimmed);
    if (pragma) {
        return trimmed.replace(
            pragma[0],
            `${pragma[1]}${pragma[2].toLowerCase()}`
        );
    }

    return sql;
}

/**
 * D1's REST API only takes ordered (`?`) bind parameters, while Sequelize's
 * sqlite dialect binds with named placeholders (`$1`, `$name`, ...) and a
 * plain-object parameter map (mirroring the `sqlite3` package). Rewrite the
 * SQL to `?` placeholders and build the ordered value array.
 */
function normalizeNamedParams(sql, params) {
    const values = [];
    const rewritten = sql.replace(/[$@:][a-zA-Z0-9_]+/g, (placeholder) => {
        const bare = placeholder.slice(1);
        let value;
        if (Object.prototype.hasOwnProperty.call(params, placeholder)) {
            value = params[placeholder];
        } else if (Object.prototype.hasOwnProperty.call(params, bare)) {
            value = params[bare];
        } else {
            // Not a bind we know about — leave the token untouched.
            return placeholder;
        }
        values.push(value);
        return '?';
    });
    return { sql: rewritten, params: values };
}

let sharedClient = null;

function getSharedClient() {
    if (!sharedClient) {
        const { d1 } = getConfig();
        sharedClient = new D1Client({
            accountId: d1.accountId,
            databaseId: d1.databaseId,
            apiToken: d1.apiToken,
            baseUrl: d1.baseUrl,
            timeoutMs: d1.timeoutMs,
            maxRequestsPerWindow: d1.maxRequestsPerWindow,
        });
    }
    return sharedClient;
}

/** Test hook: drop the cached client so config/env can be re-read. */
function _resetClient() {
    sharedClient = null;
}

class Database {
    constructor(filename, mode, callback) {
        if (typeof mode === 'function') {
            callback = mode;
        }
        // `filename` is meaningless for a remote database but kept for API
        // parity (Sequelize checks `connection.filename === ':memory:'`).
        this.filename = String(filename || 'd1-rest');
        this.open = true;
        // Serialize statement execution per connection: sqlite3 guarantees
        // ordering inside serialize(); a promise chain gives the same effect.
        this._queue = Promise.resolve();

        if (typeof callback === 'function') {
            process.nextTick(() => callback(null));
        }
    }

    serialize(fn) {
        if (typeof fn === 'function') {
            fn();
        }
    }

    parallelize(fn) {
        if (typeof fn === 'function') {
            fn();
        }
    }

    /**
     * Queue a statement. `kind` is 'run' | 'all' | 'get' | 'exec'.
     */
    _enqueue(kind, sql, params, callback) {
        if (typeof params === 'function') {
            callback = params;
            params = [];
        }
        if (params === undefined || params === null) {
            params = [];
        }
        if (!Array.isArray(params)) {
            // Named binds (plain object, sqlite3-style): rewrite to ordered.
            const normalized = normalizeNamedParams(sql, params);
            sql = normalized.sql;
            params = normalized.params;
        }

        this._queue = this._queue.then(async () => {
            const context = { lastID: 0, changes: 0 };
            try {
                const translated = translateStatement(sql);
                let results = [];
                if (translated !== null) {
                    const response = await getSharedClient().query(
                        translated,
                        params
                    );
                    results = response.results;
                    context.lastID = response.meta.last_row_id || 0;
                    context.changes = response.meta.changes || 0;
                }
                if (typeof callback === 'function') {
                    if (kind === 'all') {
                        callback.call(context, null, results);
                    } else if (kind === 'get') {
                        callback.call(context, null, results[0]);
                    } else {
                        callback.call(context, null);
                    }
                }
            } catch (err) {
                if (typeof callback === 'function') {
                    callback.call(context, err);
                } else {
                    // Mirror sqlite3: errors without callback are emitted;
                    // here we surface them loudly instead of hanging.
                    console.error('[d1RestDriver] unhandled error:', err);
                }
            }
        });

        return this;
    }

    run(sql, params, callback) {
        return this._enqueue('run', sql, params, callback);
    }

    all(sql, params, callback) {
        return this._enqueue('all', sql, params, callback);
    }

    get(sql, params, callback) {
        return this._enqueue('get', sql, params, callback);
    }

    each() {
        throw new Error('d1RestDriver does not implement Database#each');
    }

    /**
     * Execute a (possibly multi-statement) SQL string without binds.
     */
    exec(sql, callback) {
        return this._enqueue('exec', sql, [], callback);
    }

    close(callback) {
        this.open = false;
        if (typeof callback === 'function') {
            process.nextTick(() => callback(null));
        }
    }
}

module.exports = {
    Database,
    OPEN_READONLY,
    OPEN_READWRITE,
    OPEN_CREATE,
    OPEN_URI,
    OPEN_SHAREDCACHE,
    OPEN_PRIVATECACHE,
    OPEN_FULLMUTEX,
    verbose() {
        return module.exports;
    },
    _resetClient,
    _translateStatement: translateStatement,
};
