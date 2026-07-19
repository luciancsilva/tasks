'use strict';

const { safeAddColumns } = require('../utils/migration-utils');

module.exports = {
    async up(queryInterface, Sequelize) {
        await safeAddColumns(queryInterface, 'users', [
            {
                name: 'last_reviewed_at',
                definition: {
                    type: Sequelize.DATE,
                    allowNull: true,
                    defaultValue: null,
                },
            },
        ]);
    },

    async down(queryInterface) {
        await queryInterface.removeColumn('users', 'last_reviewed_at');
    },
};
