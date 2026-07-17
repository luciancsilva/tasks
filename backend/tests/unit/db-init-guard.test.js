const path = require('path');
const { spawnSync } = require('child_process');
const { isD1InitBlocked } = require('../../scripts/db-init');

const BACKEND_DIR = path.resolve(__dirname, '..', '..');

describe('db-init D1 guard', () => {
    describe('isD1InitBlocked', () => {
        it('blocks the destructive init while D1 is the active driver', () => {
            expect(isD1InitBlocked(true, undefined)).toBe(true);
        });

        it('only accepts the exact opt-in value', () => {
            expect(isD1InitBlocked(true, '0')).toBe(true);
            expect(isD1InitBlocked(true, 'true')).toBe(true);
            expect(isD1InitBlocked(true, '')).toBe(true);
            expect(isD1InitBlocked(true, '1')).toBe(false);
        });

        it('never blocks when D1 is off: the local SQLite file is disposable', () => {
            expect(isD1InitBlocked(false, undefined)).toBe(false);
            expect(isD1InitBlocked(false, '1')).toBe(false);
        });
    });

    describe('scripts/db-init.js', () => {
        it('does not run the init on require, only when executed directly', () => {
            // Reaching this line at all proves it: the require above would have
            // dropped the test database otherwise.
            expect(typeof isD1InitBlocked).toBe('function');
        });

        it('exits non-zero without touching the network when D1 is active', () => {
            const result = spawnSync(process.execPath, ['scripts/db-init.js'], {
                cwd: BACKEND_DIR,
                encoding: 'utf8',
                env: {
                    ...process.env,
                    // NODE_ENV=test hard-offs config.d1.enabled, so the guard
                    // can only be exercised outside the test environment.
                    NODE_ENV: 'production',
                    TUDUDI_DB_DRIVER: 'd1',
                    // Deliberately bogus: if the guard ever regresses, this
                    // test must not be able to reach the real D1 database.
                    // dotenv does not override already-set vars, so these
                    // win over the repo-root .env.
                    CLOUDFLARE_ACCOUNT_ID: 'fake-account',
                    CLOUDFLARE_D1_DATABASE_ID: 'fake-database',
                    CLOUDFLARE_API_TOKEN: 'fake-token',
                    TUDUDI_ALLOW_D1_INIT: '',
                },
            });

            expect(result.status).toBe(1);
            expect(result.stderr).toContain('Refusing to run');
            expect(result.stdout).not.toContain(
                'Database initialized successfully'
            );
        }, 30000);
    });
});
