'use strict';

const { safeAddColumns } = require('../utils/migration-utils');

module.exports = {
    async up(queryInterface, Sequelize) {
        await safeAddColumns(queryInterface, 'views', [
            {
                name: 'due_from',
                definition: {
                    type: Sequelize.DATEONLY,
                    allowNull: true,
                    defaultValue: null,
                },
            },
            {
                name: 'due_to',
                definition: {
                    type: Sequelize.DATEONLY,
                    allowNull: true,
                    defaultValue: null,
                },
            },
        ]);
    },

    async down(queryInterface) {
        try {
            await queryInterface.removeColumn('views', 'due_from');
        } catch (e) {
            // ignore
        }
        try {
            await queryInterface.removeColumn('views', 'due_to');
        } catch (e) {
            // ignore
        }
    },
};
