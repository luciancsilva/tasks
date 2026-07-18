'use strict';

const { safeAddColumns } = require('../utils/migration-utils');

module.exports = {
    async up(queryInterface, Sequelize) {
        await safeAddColumns(queryInterface, 'tasks', [
            {
                name: 'is_someday',
                definition: {
                    type: Sequelize.BOOLEAN,
                    allowNull: false,
                    defaultValue: false,
                },
            },
        ]);

        // Backfill: tasks with tag `someday` → is_someday = true (retrocompat).
        // Plan 49: a lista "Someday" hoje é convenção frágil via tag; mantemos
        // a tag legada funcionando enquanto o flag assume a verdade.
        await queryInterface.sequelize.query(
            `UPDATE tasks SET is_someday = 1
             WHERE id IN (
                 SELECT tt.task_id FROM tasks_tags tt
                 INNER JOIN tags ON tags.id = tt.tag_id
                 WHERE tags.name = 'someday'
             )`
        );
    },

    async down(queryInterface) {
        try {
            await queryInterface.removeColumn('tasks', 'is_someday');
        } catch (e) {
            // Idempotente: coluna ausente não é erro.
        }
    },
};
