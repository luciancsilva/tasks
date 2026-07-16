const driver = require('../../db/d1RestDriver');
const { Database, _translateStatement } = driver;

// The driver builds its shared client from config/env; point it at a mocked
// global fetch for these tests.
const okPayload = (results = [], meta = {}) => ({
    success: true,
    errors: [],
    result: [{ success: true, results, meta }],
});

describe('d1RestDriver', () => {
    let fetchMock;
    const originalFetch = global.fetch;

    beforeEach(() => {
        driver._resetClient();
        process.env.TUDUDI_DB_DRIVER = 'd1';
        process.env.CLOUDFLARE_ACCOUNT_ID = 'acc';
        process.env.CLOUDFLARE_D1_DATABASE_ID = 'db';
        process.env.CLOUDFLARE_API_TOKEN = 'token';
        fetchMock = jest.fn(async () => ({
            ok: true,
            status: 200,
            json: async () => okPayload(),
        }));
        global.fetch = fetchMock;
    });

    afterEach(() => {
        driver._resetClient();
        delete process.env.TUDUDI_DB_DRIVER;
        delete process.env.CLOUDFLARE_ACCOUNT_ID;
        delete process.env.CLOUDFLARE_D1_DATABASE_ID;
        delete process.env.CLOUDFLARE_API_TOKEN;
        global.fetch = originalFetch;
    });

    describe('statement translation', () => {
        it.each([
            'BEGIN DEFERRED TRANSACTION;',
            'COMMIT;',
            'ROLLBACK TRANSACTION;',
            'SAVEPOINT sp1;',
            'RELEASE SAVEPOINT sp1;',
            'PRAGMA journal_mode=WAL;',
            'PRAGMA busy_timeout=5000;',
            'PRAGMA synchronous=NORMAL;',
            'PRAGMA cache_size=-64000;',
            'PRAGMA temp_store=MEMORY;',
            'PRAGMA mmap_size=268435456;',
        ])('no-ops %s', (sql) => {
            expect(_translateStatement(sql)).toBeNull();
        });

        it('maps foreign_keys OFF/ON to defer_foreign_keys', () => {
            expect(_translateStatement('PRAGMA foreign_keys = OFF')).toBe(
                'PRAGMA defer_foreign_keys = true'
            );
            expect(_translateStatement('PRAGMA FOREIGN_KEYS=ON')).toBe(
                'PRAGMA defer_foreign_keys = false'
            );
        });

        it('passes through regular SQL and introspection pragmas', () => {
            expect(_translateStatement('SELECT 1')).toBe('SELECT 1');
            expect(_translateStatement('PRAGMA table_info(`tasks`)')).toBe(
                'PRAGMA table_info(`tasks`)'
            );
        });

        it('lowercases pragma names (D1 allowlist is case-sensitive)', () => {
            expect(_translateStatement('PRAGMA TABLE_INFO(`tasks`);')).toBe(
                'PRAGMA table_info(`tasks`);'
            );
            expect(
                _translateStatement('PRAGMA INDEX_LIST(`SequelizeMeta`)')
            ).toBe('PRAGMA index_list(`SequelizeMeta`)');
            expect(
                _translateStatement('PRAGMA INDEX_INFO(`sqlite_autoindex_1`)')
            ).toBe('PRAGMA index_info(`sqlite_autoindex_1`)');
        });
    });

    // Promise helpers preserving the sqlite3 `this` context.
    const openAsync = () =>
        new Promise((resolve, reject) => {
            const db = new Database('d1-rest', (err) =>
                err ? reject(err) : resolve(db)
            );
        });
    const callAsync = (db, method, sql, params) =>
        new Promise((resolve, reject) => {
            db[method](sql, params, function (err, rows) {
                if (err) return reject(err);
                resolve({ ctx: this, rows });
            });
        });

    describe('Database', () => {
        it('invokes the open callback asynchronously', async () => {
            const db = await openAsync();
            expect(db.filename).toBe('d1-rest');
        });

        it('run() exposes lastID and changes from D1 meta', async () => {
            fetchMock.mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () =>
                    okPayload([], { last_row_id: 42, changes: 1 }),
            });
            const db = new Database('d1-rest');

            const { ctx } = await callAsync(
                db,
                'run',
                'INSERT INTO tasks (name) VALUES (?)',
                ['x']
            );
            expect(ctx.lastID).toBe(42);
            expect(ctx.changes).toBe(1);
        });

        it('all() returns the result rows', async () => {
            fetchMock.mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => okPayload([{ id: 1 }, { id: 2 }]),
            });
            const db = new Database('d1-rest');

            const { rows } = await callAsync(
                db,
                'all',
                'SELECT id FROM tasks',
                []
            );
            expect(rows).toEqual([{ id: 1 }, { id: 2 }]);
        });

        it('get() returns the first row only', async () => {
            fetchMock.mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => okPayload([{ id: 9 }]),
            });
            const db = new Database('d1-rest');

            const { rows } = await callAsync(
                db,
                'get',
                'SELECT id FROM tasks LIMIT 1',
                []
            );
            expect(rows).toEqual({ id: 9 });
        });

        it('does not call the API for transaction control statements', async () => {
            const db = new Database('d1-rest');

            await callAsync(db, 'run', 'BEGIN DEFERRED TRANSACTION;', []);
            await callAsync(db, 'run', 'COMMIT;', []);
            expect(fetchMock).not.toHaveBeenCalled();
        });

        it('sends translated foreign key pragmas to the API', async () => {
            const db = new Database('d1-rest');

            await callAsync(db, 'run', 'PRAGMA foreign_keys = OFF', []);
            const body = JSON.parse(fetchMock.mock.calls[0][1].body);
            expect(body.sql).toBe('PRAGMA defer_foreign_keys = true');
        });

        it('preserves statement order (serialize semantics)', async () => {
            const order = [];
            fetchMock.mockImplementation(async (url, options) => {
                const { sql } = JSON.parse(options.body);
                // Make the first statement artificially slow.
                if (sql === 'SELECT 1') {
                    await new Promise((r) => setTimeout(r, 50));
                }
                order.push(sql);
                return {
                    ok: true,
                    status: 200,
                    json: async () => okPayload(),
                };
            });
            const db = new Database('d1-rest');

            db.serialize(() => {
                db.run('SELECT 1', [], () => {});
            });
            await callAsync(db, 'run', 'SELECT 2', []);
            expect(order).toEqual(['SELECT 1', 'SELECT 2']);
        });

        it('propagates API errors to the callback', async () => {
            fetchMock.mockResolvedValueOnce({
                ok: false,
                status: 400,
                json: async () => ({
                    success: false,
                    errors: [
                        {
                            message: 'no such table: nothere: SQLITE_ERROR',
                        },
                    ],
                }),
            });
            const db = new Database('d1-rest');

            await expect(
                callAsync(db, 'all', 'SELECT * FROM nothere', [])
            ).rejects.toMatchObject({ code: 'SQLITE_ERROR' });
        });

        it('rewrites named bind parameters to ordered ? binds', async () => {
            const db = new Database('d1-rest');

            await callAsync(
                db,
                'run',
                'INSERT INTO t (a, b, c) VALUES ($1, $2, $1)',
                {
                    1: 'x',
                    2: 'y',
                }
            );
            const body = JSON.parse(fetchMock.mock.calls[0][1].body);
            expect(body.sql).toBe('INSERT INTO t (a, b, c) VALUES (?, ?, ?)');
            expect(body.params).toEqual(['x', 'y', 'x']);
        });

        it('close() marks the connection closed and calls back', async () => {
            const db = new Database('d1-rest');
            await new Promise((resolve, reject) =>
                db.close((err) => (err ? reject(err) : resolve()))
            );
            expect(db.open).toBe(false);
        });
    });

    describe('module surface expected by Sequelize', () => {
        it('exposes the OPEN_* constants and verbose()', () => {
            expect(driver.OPEN_READWRITE).toBe(2);
            expect(driver.OPEN_CREATE).toBe(4);
            expect(driver.verbose()).toBe(driver);
        });
    });
});
