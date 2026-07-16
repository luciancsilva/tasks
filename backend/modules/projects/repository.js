'use strict';

const {
    Project,
    Task,
    Tag,
    Area,
    Goal,
    Note,
    User,
    Permission,
    sequelize,
    TaskEvent,
    RecurringCompletion,
    CalDAVSyncState,
    CalDAVOccurrenceOverride,
} = require('../../models');
const { Op } = require('sequelize');
const r2Service = require('../../services/r2Service');
const { deleteAttachmentsForTaskIds } = require('../tasks/attachmentCleanup');
const { logError } = require('../../services/logService');

class ProjectsRepository {
    constructor() {
        this.model = Project;
    }

    async findById(id, options = {}) {
        return this.model.findByPk(id, options);
    }

    async findOne(where, options = {}) {
        return this.model.findOne({ where, ...options });
    }

    async findAll(where = {}, options = {}) {
        return this.model.findAll({ where, ...options });
    }

    async create(data, options = {}) {
        return this.model.create(data, options);
    }

    async update(instance, data, options = {}) {
        return instance.update(data, options);
    }

    async destroy(instance, options = {}) {
        return instance.destroy(options);
    }

    async count(where = {}, options = {}) {
        return this.model.count({ where, ...options });
    }

    async exists(where) {
        const count = await this.count(where);
        return count > 0;
    }


    /**
     * Find all projects with filters and includes.
     */
    async findAllWithFilters(whereClause) {
        return this.model.findAll({
            where: whereClause,
            include: [
                {
                    model: Task,
                    required: false,
                    attributes: ['id', 'status'],
                    where: {
                        parent_task_id: null,
                        recurring_parent_id: null,
                    },
                },
                {
                    model: Area,
                    required: false,
                    attributes: ['id', 'uid', 'name', 'color'],
                },
                {
                    model: Goal,
                    as: 'Goal',
                    required: false,
                    attributes: [
                        'id',
                        'uid',
                        'title',
                        'status',
                        'horizon',
                        'target_date',
                        'area_id',
                    ],
                },
                {
                    model: Tag,
                    attributes: ['id', 'name', 'uid', 'color'],
                    through: { attributes: [] },
                },
                {
                    model: User,
                    required: false,
                    attributes: ['uid'],
                },
            ],
            order: [['name', 'ASC']],
        });
    }

    /**
     * Get share counts for multiple projects.
     */
    async getShareCounts(projectUids) {
        if (projectUids.length === 0) return {};

        const shareCounts = await Permission.findAll({
            attributes: [
                'resource_uid',
                [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
            ],
            where: {
                resource_type: 'project',
                resource_uid: { [Op.in]: projectUids },
            },
            group: ['resource_uid'],
            raw: true,
        });

        const uidToCount = {};
        shareCounts.forEach((item) => {
            uidToCount[item.resource_uid] = parseInt(item.count, 10);
        });

        return uidToCount;
    }

    /**
     * Find project by UID (simple).
     */
    async findByUid(uid) {
        return this.model.findOne({
            where: { uid },
            attributes: ['id', 'uid', 'user_id'],
        });
    }

    /**
     * Find project by UID with full includes.
     */
    async findByUidWithIncludes(uid) {
        return this.model.findOne({
            where: { uid },
            include: [
                {
                    model: Task,
                    required: false,
                    where: {
                        parent_task_id: null,
                        recurring_parent_id: null,
                    },
                    include: [
                        {
                            model: Tag,
                            attributes: ['id', 'name', 'uid', 'color'],
                            through: { attributes: [] },
                            required: false,
                        },
                        {
                            model: Task,
                            as: 'Subtasks',
                            include: [
                                {
                                    model: Tag,
                                    attributes: ['id', 'name', 'uid', 'color'],
                                    through: { attributes: [] },
                                    required: false,
                                },
                            ],
                            required: false,
                        },
                    ],
                },
                {
                    model: Note,
                    required: false,
                    attributes: [
                        'id',
                        'uid',
                        'title',
                        'content',
                        'created_at',
                        'updated_at',
                    ],
                    include: [
                        {
                            model: Tag,
                            attributes: ['id', 'name', 'uid', 'color'],
                            through: { attributes: [] },
                        },
                    ],
                },
                {
                    model: Area,
                    required: false,
                    attributes: ['id', 'uid', 'name'],
                },
                {
                    model: Goal,
                    as: 'Goal',
                    required: false,
                    attributes: [
                        'id',
                        'uid',
                        'title',
                        'status',
                        'horizon',
                        'target_date',
                        'area_id',
                    ],
                },
                {
                    model: Tag,
                    attributes: ['id', 'name', 'uid', 'color'],
                    through: { attributes: [] },
                },
            ],
        });
    }

    /**
     * Find project by UID with tags and area.
     */
    async findByUidWithTagsAndArea(uid) {
        return this.model.findOne({
            where: { uid },
            include: [
                {
                    model: Tag,
                    attributes: ['id', 'name', 'uid', 'color'],
                    through: { attributes: [] },
                },
                {
                    model: Area,
                    required: false,
                    attributes: ['id', 'uid', 'name'],
                },
                {
                    model: Goal,
                    as: 'Goal',
                    required: false,
                    attributes: [
                        'id',
                        'uid',
                        'title',
                        'status',
                        'horizon',
                        'target_date',
                        'area_id',
                    ],
                },
            ],
        });
    }

    /**
     * Get share count for a single project.
     */
    async getShareCount(projectUid) {
        return Permission.count({
            where: {
                resource_type: 'project',
                resource_uid: projectUid,
            },
        });
    }

    /**
     * Find area by UID.
     */
    async findAreaByUid(uid) {
        return Area.findOne({
            where: { uid },
            attributes: ['id'],
        });
    }

    /**
     * Best-effort removal of a project cover image object from R2.
     * Accepts the stored image_url (e.g. '/api/uploads/projects/project-1.jpg')
     * and ignores anything that does not point at the uploads proxy (external
     * URLs are never deleted).
     */
    async deleteProjectImageFromR2(imageUrl, transaction = null) {
        if (!imageUrl) {
            return false;
        }
        const urlMatch = String(imageUrl).match(
            /\/api\/uploads\/projects\/(.+)$/
        );
        if (!urlMatch) {
            return false;
        }
        const objectKey = `projects/${urlMatch[1]}`;
        if (transaction) {
            transaction.afterCommit(async () => {
                await r2Service.deleteObject(objectKey);
            });
            return true;
        } else {
            return r2Service.deleteObject(objectKey);
        }
    }

    /**
     * Delete project with cascade deletion of tasks and cleanup of files.
     * Notes are orphaned (project_id set to null) as they are reference material.
     */
    async deleteWithOrphaning(project, userId) {
        await sequelize.transaction(async (transaction) => {
            try {
                // Find all tasks belonging to this project (parent tasks only)
                const tasks = await Task.findAll({
                    where: {
                        project_id: project.id,
                        user_id: userId,
                        parent_task_id: null, // Only get parent tasks
                    },
                    attributes: ['id'],
                    include: [
                        {
                            model: Task,
                            as: 'Subtasks',
                            attributes: ['id'],
                            required: false,
                        },
                    ],
                    transaction,
                });

                // Delete attachments (R2 objects + rows) for tasks and subtasks
                const taskIds = [];
                for (const task of tasks) {
                    taskIds.push(task.id);
                    for (const subtask of task.Subtasks || []) {
                        taskIds.push(subtask.id);
                    }
                }
                await deleteAttachmentsForTaskIds(taskIds, { transaction });

                if (taskIds.length > 0) {
                    // Clear recurring parent relationships
                    await Task.update(
                        { recurring_parent_id: null },
                        {
                            where: { recurring_parent_id: taskIds },
                            transaction,
                        }
                    );

                    // Delete the tasks belonging to the project (dependents will be deleted automatically by database ON DELETE CASCADE)
                    await Task.destroy({
                        where: { project_id: project.id, user_id: userId },
                        transaction,
                    });
                }

                // Orphan notes (they are reference material and may be useful without the project)
                await Note.update(
                    { project_id: null },
                    {
                        where: { project_id: project.id, user_id: userId },
                        transaction,
                    }
                );

                // Delete project cover image from R2 if it exists
                await this.deleteProjectImageFromR2(project.image_url, transaction);

                // Delete the project (project tags and other dependents will be deleted automatically by database ON DELETE CASCADE)
                await project.destroy({ transaction });
            } catch (error) {
                logError('Error deleting project:', error);
                throw error;
            }
        });
    }

    /**
     * Find existing tags by names for a user.
     */
    async findTagsByNames(userId, tagNames) {
        return Tag.findAll({
            where: { user_id: userId, name: tagNames },
        });
    }

    /**
     * Create a tag.
     */
    async createTag(name, userId) {
        return Tag.create({ name, user_id: userId });
    }
}

module.exports = new ProjectsRepository();
