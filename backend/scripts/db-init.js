#!/usr/bin/env node

/**
 * Database Initialization Script
 * Initializes the database by creating all tables and dropping existing data
 */

try {
    require('dotenv').config();
    // Repo-root .env fallback (dotenv never overrides already-set vars).
    require('dotenv').config({
        path: require('path').resolve(__dirname, '..', '..', '.env'),
    });
} catch (_) {}
const { sequelize } = require('../models');
const { getConfig } = require('../config/config');

/**
 * sync({ force: true }) drops every table. Against the local SQLite file that
 * only costs a dev database; against D1 it destroys the remote production data.
 * Bootstrapping an *empty* D1 is the one legitimate case for running it there
 * (plans/07-d1-activation.md), so it requires explicit opt-in.
 *
 * @param {boolean} d1Enabled  config.d1.enabled
 * @param {string} [allowFlag] process.env.TUDUDI_ALLOW_D1_INIT
 * @returns {boolean} true when the destructive init must be refused
 */
function isD1InitBlocked(d1Enabled, allowFlag) {
    return Boolean(d1Enabled) && allowFlag !== '1';
}

async function initDatabase() {
    try {
        if (
            isD1InitBlocked(
                getConfig().d1.enabled,
                process.env.TUDUDI_ALLOW_D1_INIT
            )
        ) {
            console.error(
                '❌ Refusing to run: TUDUDI_DB_DRIVER=d1 is active and this would DROP every table in the remote D1 database.'
            );
            console.error(
                '   Set TUDUDI_ALLOW_D1_INIT=1 only when bootstrapping an empty D1.'
            );
            process.exit(1);
        }

        console.log('Initializing database...');
        console.log('WARNING: This will drop all existing data!');

        await sequelize.sync({ force: true });

        console.log('✅ Database initialized successfully');
        console.log(
            'All tables have been created and existing data has been cleared'
        );
        process.exit(0);
    } catch (error) {
        console.error('❌ Error initializing database:', error.message);
        process.exit(1);
    }
}

if (require.main === module) {
    initDatabase();
}

module.exports = { isD1InitBlocked, initDatabase };
