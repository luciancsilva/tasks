'use strict';

module.exports = {
    async up(queryInterface) {
        await queryInterface.sequelize.query(
            "UPDATE users SET language = 'ja' WHERE language = 'jp'"
        );
        await queryInterface.sequelize.query(
            "UPDATE users SET language = 'uk' WHERE language = 'ua'"
        );
    },

    async down(queryInterface) {
        await queryInterface.sequelize.query(
            "UPDATE users SET language = 'jp' WHERE language = 'ja'"
        );
        await queryInterface.sequelize.query(
            "UPDATE users SET language = 'ua' WHERE language = 'uk'"
        );
    },
};
