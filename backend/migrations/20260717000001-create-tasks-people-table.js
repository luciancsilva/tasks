'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        const tables = await queryInterface.showAllTables();
        if (!tables.includes('tasks_people')) {
            await queryInterface.createTable('tasks_people', {
                task_id: {
                    type: Sequelize.INTEGER,
                    references: {
                        model: 'tasks',
                        key: 'id',
                    },
                    onDelete: 'CASCADE',
                },
                person_id: {
                    type: Sequelize.INTEGER,
                    references: {
                        model: 'people',
                        key: 'id',
                    },
                    onDelete: 'CASCADE',
                },
                created_at: {
                    allowNull: false,
                    type: Sequelize.DATE,
                    defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
                },
                updated_at: {
                    allowNull: false,
                    type: Sequelize.DATE,
                    defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
                },
            });

            await queryInterface.addIndex(
                'tasks_people',
                ['task_id', 'person_id'],
                {
                    unique: true,
                    name: 'tasks_people_unique_idx',
                }
            );
        }
    },

    async down(queryInterface, Sequelize) {
        await queryInterface.dropTable('tasks_people');
    },
};
