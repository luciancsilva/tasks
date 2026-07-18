'use strict';

const { safeAddColumns } = require('../utils/migration-utils');

module.exports = {
    async up(queryInterface, Sequelize) {
        await safeAddColumns(queryInterface, 'tasks', [
            {
                name: 'time_estimate',
                definition: {
                    type: Sequelize.INTEGER,
                    allowNull: true,
                    defaultValue: null,
                    comment:
                        'Estimated time to complete, in minutes (1-1440). Powers GTD time-available filters (?time_max=/?time_min=).',
                },
            },
        ]);
    },

    async down(queryInterface) {
        try {
            await queryInterface.removeColumn('tasks', 'time_estimate');
        } catch (e) {
            // Idempotente: coluna ausente não é erro.
        }
    },
};
