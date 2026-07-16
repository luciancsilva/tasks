require('dotenv').config();
// Also load the repo-root .env (dotenv never overrides vars already set):
// backend scripts run with cwd=backend/, where no .env exists.
require('dotenv').config({
    path: require('path').resolve(__dirname, '..', '..', '.env'),
});

const { getConfig } = require('../config/config');
const config = getConfig();

// With TUDUDI_DB_DRIVER=d1 the sequelize-cli migrations run against
// Cloudflare D1 through the REST API driver (backend/db/d1RestDriver.js),
// exactly like the application runtime. Same SQLite dialect either way.
const useD1 = config.d1.enabled;

const base = {
    dialect: 'sqlite',
    storage: useD1 ? 'd1-rest' : config.dbFile,
    dialectModule: useD1 ? require('../db/d1RestDriver') : undefined,
    define: {
        timestamps: true,
        underscored: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
    },
};

// SQL_DEBUG=1 prints every statement (useful to pinpoint which SQL a remote
// D1 rejects during migrations).
const debugLogging = process.env.SQL_DEBUG ? console.log : false;

module.exports = {
    development: { ...base, logging: console.log },
    test: { ...base, logging: debugLogging },
    production: { ...base, logging: debugLogging },
};
