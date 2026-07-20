'use strict';
const { Comment } = require('../../models');
class CommentsRepository {
    async findByTaskId(taskId) {
        return Comment.findAll({
            where: { task_id: taskId },
            order: [['created_at', 'ASC']],
        });
    }
    async create(data) {
        return Comment.create(data);
    }
    async findByUid(uid) {
        return Comment.findOne({ where: { uid } });
    }
    async delete(comment) {
        return comment.destroy();
    }
}
module.exports = new CommentsRepository();
