'use strict';

const { safeAddColumns } = require('../utils/migration-utils');

module.exports = {
    async up(queryInterface, Sequelize) {
        await safeAddColumns(queryInterface, 'users', [
            {
                name: 'weekly_review_enabled',
                definition: {
                    type: Sequelize.BOOLEAN,
                    allowNull: false,
                    defaultValue: true,
                },
            },
            {
                name: 'weekly_review_day',
                definition: {
                    type: Sequelize.STRING,
                    allowNull: false,
                    defaultValue: 'friday',
                },
            },
            {
                name: 'weekly_review_time',
                definition: {
                    type: Sequelize.STRING,
                    allowNull: false,
                    defaultValue: '16:00',
                },
            },
        ]);
    },

    async down(queryInterface) {
        const cols = [
            'weekly_review_enabled',
            'weekly_review_day',
            'weekly_review_time',
        ];
        for (const col of cols) {
            try {
                await queryInterface.removeColumn('users', col);
            } catch (e) {
                // ignore if column already absent
            }
        }
    },
};
