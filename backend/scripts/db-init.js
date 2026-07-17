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

/**
 * sync({ force: true }) drops every table. Refuse to run it against a
 * database file that already exists and has content, unless the operator
 * explicitly opts in via TUDUDI_ALLOW_DB_INIT=1.
 *
 * @param {string|undefined} storagePath  sequelize.options.storage
 * @param {string|undefined} allowFlag    process.env.TUDUDI_ALLOW_DB_INIT
 * @returns {boolean} true when the destructive init must be refused
 */
function isInitBlocked(storagePath, allowFlag) {
    if (allowFlag === '1') return false;
    if (!storagePath || storagePath === ':memory:') return false;
    try {
        const stat = require('fs').statSync(storagePath);
        return stat.size > 0;
    } catch (_) {
        return false; // arquivo não existe: init é o caminho correto
    }
}

async function initDatabase() {
    try {
        console.log('Initializing database...');
        console.log('WARNING: This will drop all existing data!');

        if (
            isInitBlocked(
                sequelize.options.storage,
                process.env.TUDUDI_ALLOW_DB_INIT
            )
        ) {
            console.error(
                '❌ Error: Database file already exists and has content.'
            );
            console.error(
                'Running db:init will drop all existing data and tables!'
            );
            console.error(
                'If you really want to do this, run with TUDUDI_ALLOW_DB_INIT=1.'
            );
            console.error(
                'Otherwise, run db:migrate to apply pending migrations.'
            );
            process.exit(1);
        }

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

module.exports = { initDatabase, isInitBlocked };
