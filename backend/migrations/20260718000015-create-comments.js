'use strict';
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('comments', {
            id: {
                type: Sequelize.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            uid: { type: Sequelize.STRING, unique: true, allowNull: false },
            task_id: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: { model: 'tasks', key: 'id' },
                onDelete: 'CASCADE',
            },
            user_id: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: { model: 'users', key: 'id' },
            },
            content: { type: Sequelize.TEXT, allowNull: false },
            created_at: {
                type: Sequelize.DATE,
                allowNull: false,
                defaultValue: Sequelize.NOW,
            },
            updated_at: {
                type: Sequelize.DATE,
                allowNull: false,
                defaultValue: Sequelize.NOW,
            },
        });
        await queryInterface.addIndex('comments', ['task_id']);
    },
    async down(queryInterface) {
        await queryInterface.dropTable('comments');
    },
};
