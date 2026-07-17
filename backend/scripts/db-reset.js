#!/usr/bin/env node

/**
 * Database Reset Script
 * Resets the database by dropping and recreating all tables
 */

try {
    require('dotenv').config();
    // Repo-root .env fallback (dotenv never overrides already-set vars).
    require('dotenv').config({
        path: require('path').resolve(__dirname, '..', '..', '.env'),
    });
} catch (_) {}
const { sequelize } = require('../models');
const { isInitBlocked } = require('./db-init');

async function resetDatabase() {
    try {
        console.log('Resetting database...');
        console.log('WARNING: This will permanently delete all data!');

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
                'Running db:reset will drop all existing data and tables!'
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

        console.log('✅ Database reset successfully');
        console.log('All tables have been dropped and recreated');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error resetting database:', error.message);
        process.exit(1);
    }
}

if (require.main === module) {
    resetDatabase();
}

module.exports = { resetDatabase };
