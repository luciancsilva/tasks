'use strict';

const { safeAddColumns } = require('../utils/migration-utils');

module.exports = {
    async up(queryInterface, Sequelize) {
        await safeAddColumns(queryInterface, 'users', [
            {
                name: 'stale_task_days',
                definition: {
                    type: Sequelize.INTEGER,
                    allowNull: false,
                    defaultValue: 30,
                    comment:
                        'Threshold in days for ?type=stale (task not updated in N days). User-configurable, default 30.',
                },
            },
        ]);
    },

    async down(queryInterface) {
        try {
            await queryInterface.removeColumn('users', 'stale_task_days');
        } catch (e) {
            // Idempotente: coluna ausente não é erro.
        }
    },
};
