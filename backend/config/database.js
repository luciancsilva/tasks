require('dotenv').config();
// Also load the repo-root .env (dotenv never overrides vars already set):
// backend scripts run with cwd=backend/, where no .env exists.
require('dotenv').config({
    path: require('path').resolve(__dirname, '..', '..', '.env'),
});

const { getConfig } = require('../config/config');
const config = getConfig();

const base = {
    dialect: 'sqlite',
    storage: config.dbFile,
    define: {
        timestamps: true,
        underscored: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
    },
};

// SQL_DEBUG=1 prints every statement (useful to pinpoint which SQL a migration
// rejects).
const debugLogging = process.env.SQL_DEBUG ? console.log : false;

module.exports = {
    development: { ...base, logging: console.log },
    test: { ...base, logging: debugLogging },
    production: { ...base, logging: debugLogging },
};
