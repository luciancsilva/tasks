'use strict';

const { safeAddColumns } = require('../utils/migration-utils');

module.exports = {
    async up(queryInterface, Sequelize) {
        await safeAddColumns(queryInterface, 'tasks', [
            {
                name: 'waiting_since',
                definition: {
                    type: Sequelize.DATE,
                    allowNull: true,
                    defaultValue: null,
                    comment:
                        'Auto-set when status transitions to waiting; cleared when leaving it. Powers follow-up overdue filter (?type=waiting&waiting_overdue_days=N).',
                },
            },
        ]);
    },

    async down(queryInterface) {
        try {
            await queryInterface.removeColumn('tasks', 'waiting_since');
        } catch (e) {
            // Idempotente: coluna ausente não é erro.
        }
    },
};
