'use strict';

const { safeAddColumns } = require('../utils/migration-utils');

module.exports = {
    async up(queryInterface, Sequelize) {
        await safeAddColumns(queryInterface, 'views', [
            {
                name: 'tags_any',
                definition: {
                    type: Sequelize.TEXT,
                    allowNull: true,
                    defaultValue: null,
                },
            },
        ]);
    },

    async down(queryInterface) {
        try {
            await queryInterface.removeColumn('views', 'tags_any');
        } catch (e) {
            // ignore if column already absent
        }
    },
};
