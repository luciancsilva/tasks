'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.addColumn('users', 'inbox_stale_hours', {
            type: Sequelize.INTEGER,
            allowNull: false,
            defaultValue: 48,
        });
    },

    async down(queryInterface, Sequelize) {
        await queryInterface.removeColumn('users', 'inbox_stale_hours');
    },
};
