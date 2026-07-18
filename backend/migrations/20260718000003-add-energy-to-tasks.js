'use strict';

const { safeAddColumns } = require('../utils/migration-utils');

module.exports = {
    async up(queryInterface, Sequelize) {
        await safeAddColumns(queryInterface, 'tasks', [
            {
                name: 'energy',
                definition: {
                    type: Sequelize.INTEGER,
                    allowNull: true,
                    defaultValue: null,
                    comment:
                        'Mental energy level (0=low, 1=medium, 2=high). Distinct axis from priority. Powers ?energy= filter.',
                },
            },
        ]);
    },

    async down(queryInterface) {
        try {
            await queryInterface.removeColumn('tasks', 'energy');
        } catch (e) {
            // Idempotente: coluna ausente não é erro.
        }
    },
};
