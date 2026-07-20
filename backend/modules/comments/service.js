'use strict';
const { Comment, Task, User, Notification } = require('../../models');
const {
    NotFoundError,
    ForbiddenError,
    ValidationError,
} = require('../../shared/errors');
const permissionsService = require('../../services/permissionsService');

class CommentsService {
    async list(userId, taskUid) {
        const task = await Task.findOne({ where: { uid: taskUid } });
        if (!task) throw new NotFoundError('Task not found');
        const access = await permissionsService.getAccess(
            userId,
            'task',
            taskUid
        );
        if (access === 'none') throw new ForbiddenError('No access');
        return Comment.findAll({
            where: { task_id: task.id },
            include: [{ model: User, attributes: ['id', 'name', 'email'] }],
            order: [['created_at', 'ASC']],
        });
    }

    async create(userId, taskUid, content) {
        if (!content || !content.trim())
            throw new ValidationError('Content required');
        const task = await Task.findOne({ where: { uid: taskUid } });
        if (!task) throw new NotFoundError('Task not found');
        const access = await permissionsService.getAccess(
            userId,
            'task',
            taskUid
        );
        if (access !== 'rw' && task.user_id !== userId)
            throw new ForbiddenError('Write access required');
        const comment = await Comment.create({
            task_id: task.id,
            user_id: userId,
            content: content.trim(),
        });
        // Notif comment_added para task owner (se não for o autor)
        if (task.user_id !== userId) {
            await Notification.createNotification({
                userId: task.user_id,
                type: 'comment_added',
                level: 'info',
                title: 'New comment on task',
                message: content.trim().slice(0, 100),
                sources: ['in-app'],
                data: {
                    taskUid,
                    taskName: task.name,
                    commentUid: comment.uid,
                    authorId: userId,
                },
                sentAt: new Date(),
            });
        }

        // Fetch comment with user to return
        return Comment.findOne({
            where: { id: comment.id },
            include: [{ model: User, attributes: ['id', 'name', 'email'] }],
        });
    }

    async update(userId, commentUid, content) {
        if (!content || !content.trim())
            throw new ValidationError('Content required');
        const comment = await Comment.findOne({ where: { uid: commentUid } });
        if (!comment) throw new NotFoundError('Comment not found');
        if (comment.user_id !== userId)
            throw new ForbiddenError('Only author can edit');
        await comment.update({ content: content.trim() });
        return Comment.findOne({
            where: { id: comment.id },
            include: [{ model: User, attributes: ['id', 'name', 'email'] }],
        });
    }

    async delete(userId, commentUid) {
        const comment = await Comment.findOne({ where: { uid: commentUid } });
        if (!comment) throw new NotFoundError('Comment not found');
        if (comment.user_id !== userId) {
            // verificar rw no parent task
            const task = await Task.findByPk(comment.task_id);
            const access = await permissionsService.getAccess(
                userId,
                'task',
                task.uid
            );
            if (access !== 'rw' && task.user_id !== userId)
                throw new ForbiddenError('Cannot delete');
        }
        await comment.destroy();
    }
}

module.exports = new CommentsService();
