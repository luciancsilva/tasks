/**
 * End-to-end proof that Sequelize works on top of the D1 REST driver.
 *
 * A fake `fetch` emulates the Cloudflare D1 /query endpoint by executing the
 * received SQL against a real in-memory SQLite database and answering with a
 * D1-shaped payload. Sequelize is then pointed at the driver via
 * `dialectModule`, exercising the full chain: connection open, serialize,
 * CREATE TABLE, INSERT (lastID), SELECT, UPDATE (changes), transactions
 * (no-op BEGIN/COMMIT) and raw queries.
 */

const sqlite3 = require('sqlite3');
const { Sequelize, DataTypes } = require('sequelize');
const driver = require('../../db/d1RestDriver');

function makeD1Emulator() {
    const raw = new sqlite3.Database(':memory:');

    const execute = (sql, params) =>
        new Promise((resolve, reject) => {
            if (/^\s*(SELECT|PRAGMA|WITH)/i.test(sql)) {
                raw.all(sql, params, (err, rows) => {
                    if (err) return reject(err);
                    resolve({ results: rows || [], meta: {} });
                });
            } else {
                raw.run(sql, params, function (err) {
                    if (err) return reject(err);
                    resolve({
                        results: [],
                        meta: {
                            last_row_id: this.lastID,
                            changes: this.changes,
                        },
                    });
                });
            }
        });

    const fetchImpl = async (url, options) => {
        const { sql, params } = JSON.parse(options.body);
        try {
            const { results, meta } = await execute(sql, params || []);
            return {
                ok: true,
                status: 200,
                json: async () => ({
                    success: true,
                    errors: [],
                    result: [{ success: true, results, meta }],
                }),
            };
        } catch (err) {
            return {
                ok: false,
                status: 400,
                json: async () => ({
                    success: false,
                    errors: [{ message: `${err.message}: ${err.code}` }],
                }),
            };
        }
    };

    return { raw, fetchImpl };
}

describe('Sequelize over the D1 REST driver', () => {
    let sequelize, Item, emulator;
    const originalFetch = global.fetch;

    beforeAll(async () => {
        process.env.CLOUDFLARE_ACCOUNT_ID = 'acc';
        process.env.CLOUDFLARE_D1_DATABASE_ID = 'db';
        process.env.CLOUDFLARE_API_TOKEN = 'token';
        driver._resetClient();

        emulator = makeD1Emulator();
        global.fetch = emulator.fetchImpl;

        sequelize = new Sequelize({
            dialect: 'sqlite',
            storage: 'd1-rest',
            dialectModule: driver,
            logging: false,
            define: {
                timestamps: true,
                underscored: true,
                createdAt: 'created_at',
                updatedAt: 'updated_at',
            },
        });

        Item = sequelize.define('Item', {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            name: { type: DataTypes.STRING, allowNull: false },
            done: { type: DataTypes.BOOLEAN, defaultValue: false },
        });

        await sequelize.sync();
    });

    afterAll(async () => {
        await sequelize.close();
        global.fetch = originalFetch;
        driver._resetClient();
        delete process.env.CLOUDFLARE_ACCOUNT_ID;
        delete process.env.CLOUDFLARE_D1_DATABASE_ID;
        delete process.env.CLOUDFLARE_API_TOKEN;
    });

    it('creates rows and returns the D1 last_row_id as the new PK', async () => {
        const first = await Item.create({ name: 'first' });
        const second = await Item.create({ name: 'second' });

        expect(first.id).toBe(1);
        expect(second.id).toBe(2);
    });

    it('reads rows back through findAll/findOne', async () => {
        const items = await Item.findAll({ order: [['id', 'ASC']] });
        expect(items.map((i) => i.name)).toEqual(['first', 'second']);

        const one = await Item.findOne({ where: { name: 'second' } });
        expect(one.id).toBe(2);
    });

    it('updates rows and reports affected count from D1 meta', async () => {
        const [affected] = await Item.update(
            { done: true },
            { where: { name: 'first' } }
        );
        expect(affected).toBe(1);

        const reloaded = await Item.findByPk(1);
        expect(reloaded.done).toBe(true);
    });

    it('supports managed transactions (as stateless no-ops)', async () => {
        await sequelize.transaction(async (transaction) => {
            await Item.create({ name: 'tx-item' }, { transaction });
        });

        const found = await Item.findOne({ where: { name: 'tx-item' } });
        expect(found).not.toBeNull();
    });

    it('supports raw queries with replacements', async () => {
        const [rows] = await sequelize.query(
            'SELECT COUNT(*) as total FROM `Items` WHERE name != ?',
            { replacements: ['nope'] }
        );
        expect(rows[0].total).toBe(3);
    });

    it('destroys rows', async () => {
        const destroyed = await Item.destroy({
            where: { name: 'tx-item' },
        });
        expect(destroyed).toBe(1);
        expect(await Item.count()).toBe(2);
    });

    it('surfaces constraint violations as errors', async () => {
        await expect(Item.create({ name: null })).rejects.toBeTruthy();
    });

    it('handles the foreign_keys PRAGMA sequence used by delete flows', async () => {
        await expect(
            sequelize.query('PRAGMA foreign_keys = OFF')
        ).resolves.toBeTruthy();
        await expect(
            sequelize.query('PRAGMA foreign_keys = ON')
        ).resolves.toBeTruthy();
    });
});
