'use strict';

const { safeAddColumns } = require('../utils/migration-utils');

module.exports = {
    async up(queryInterface, Sequelize) {
        await safeAddColumns(queryInterface, 'views', [
            {
                name: 'energy',
                definition: {
                    type: Sequelize.STRING,
                    allowNull: true,
                    defaultValue: null,
                    comment:
                        "Saved-view energy filter ('low'|'medium'|'high'). Mirrors tasks.energy.",
                },
            },
        ]);
    },

    async down(queryInterface) {
        try {
            await queryInterface.removeColumn('views', 'energy');
        } catch (e) {
            // Idempotente: coluna ausente não é erro.
        }
    },
};
