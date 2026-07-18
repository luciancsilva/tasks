'use strict';

const { safeAddColumns } = require('../utils/migration-utils');

module.exports = {
    async up(queryInterface, Sequelize) {
        await safeAddColumns(queryInterface, 'views', [
            {
                name: 'time_max',
                definition: {
                    type: Sequelize.INTEGER,
                    allowNull: true,
                    defaultValue: null,
                    comment:
                        'Saved-view time-available filter, in minutes. Mirrors tasks.time_estimate.',
                },
            },
        ]);
    },

    async down(queryInterface) {
        try {
            await queryInterface.removeColumn('views', 'time_max');
        } catch (e) {
            // Idempotente: coluna ausente não é erro.
        }
    },
};
