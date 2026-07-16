require('dotenv').config();
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

module.exports = {
    development: { ...base, logging: console.log },
    test: { ...base, logging: false },
    production: { ...base, logging: false },
};
