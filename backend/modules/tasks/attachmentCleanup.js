'use strict';

/**
 * Shared cleanup for task attachments: removes the R2 objects (best-effort)
 * and the task_attachments rows for a set of task ids.
 *
 * Used by the task delete route and by project cascade deletion so both flows
 * share the same behavior as the single-attachment delete endpoint
 * (modules/tasks/attachments.js): R2 object first, DB row second. R2 failures
 * never block the deletion (r2Service.deleteObject never throws).
 */

const { TaskAttachment } = require('../../models');
const r2Service = require('../../services/r2Service');

/**
 * Delete every attachment belonging to the given task ids.
 *
 * @param {number[]|number} taskIds  Task ids whose attachments must be removed.
 * @param {object} [options]
 * @param {object} [options.transaction]  Sequelize transaction for the row deletes.
 * @returns {Promise<number>} number of attachments removed.
 */
async function deleteAttachmentsForTaskIds(taskIds, options = {}) {
    const ids = (Array.isArray(taskIds) ? taskIds : [taskIds]).filter(
        (id) => id !== null && id !== undefined
    );
    if (ids.length === 0) {
        return 0;
    }

    const attachments = await TaskAttachment.findAll({
        where: { task_id: ids },
        transaction: options.transaction,
    });

    const filePaths = attachments.map((a) => a.file_path);

    for (const attachment of attachments) {
        await attachment.destroy({ transaction: options.transaction });
    }

    if (options.transaction) {
        options.transaction.afterCommit(async () => {
            for (const filePath of filePaths) {
                await r2Service.deleteObject(filePath);
            }
        });
    } else {
        for (const filePath of filePaths) {
            await r2Service.deleteObject(filePath);
        }
    }

    return attachments.length;
}

module.exports = { deleteAttachmentsForTaskIds };
