'use strict';

const { safeAddColumns } = require('../utils/migration-utils');

module.exports = {
    async up(queryInterface, Sequelize) {
        await safeAddColumns(queryInterface, 'projects', [
            {
                name: 'execution_mode',
                definition: {
                    type: Sequelize.STRING,
                    allowNull: false,
                    defaultValue: 'parallel',
                    comment:
                        "GTD parallel vs sequential project. 'sequential' hides all but the first not-done task (by order) from action lists (today/upcoming).",
                },
            },
        ]);
    },

    async down(queryInterface) {
        try {
            await queryInterface.removeColumn('projects', 'execution_mode');
        } catch (e) {
            // Idempotente: coluna ausente não é erro.
        }
    },
};
