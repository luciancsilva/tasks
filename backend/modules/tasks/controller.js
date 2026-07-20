'use strict';

const tasksService = require('./service');
const { addPerformanceHeaders } = require('./operations/list');
const {
    resetQueryCounter,
    getQueryStats,
} = require('../../middleware/queryLogger');
const { ValidationError } = require('../../shared/errors');
const { logError } = require('../../services/logService');

/**
 * Tasks controller - handles HTTP requests/responses.
 */
const tasksController = {
    /**
     * GET /api/tasks
     */
    async list(req, res, next) {
        const startTime = Date.now();
        resetQueryCounter();

        try {
            const { id: userId, timezone, language } = req.currentUser;
            const response = await tasksService.list(
                userId,
                timezone,
                language,
                req.query
            );

            addPerformanceHeaders(res, startTime, getQueryStats());
            res.json(response);
        } catch (error) {
            logError('Error fetching tasks:', error);
            if (error.message === 'Invalid order column specified.') {
                return next(new ValidationError(error.message));
            }
            next(error);
        }
    },

    /**
     * GET /api/tasks/metrics
     */
    async metrics(req, res, next) {
        try {
            const response = await tasksService.getMetrics(
                req.currentUser.id,
                req.currentUser.timezone,
                req.query.type
            );
            res.json(response);
        } catch (error) {
            logError('Error fetching task metrics:', error);
            next(error);
        }
    },

    /**
     * POST /api/task
     */
    async create(req, res, next) {
        try {
            const { task, isFallback } = await tasksService.create(
                req.currentUser.id,
                req.currentUser.timezone,
                req.body
            );

            if (!isFallback) {
                res.set({
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                    Pragma: 'no-cache',
                    Expires: '0',
                });
            }

            res.status(201).json(task);
        } catch (error) {
            logError('Error creating task:', error);
            next(error);
        }
    },

    /**
     * GET /api/task/:uid
     */
    async getOne(req, res, next) {
        try {
            const task = await tasksService.getByUid(
                req.params.uid,
                req.currentUser.timezone
            );
            res.json(task);
        } catch (error) {
            logError('Error fetching task:', error);
            next(error);
        }
    },

    /**
     * PATCH /api/task/:uid
     */
    async update(req, res, next) {
        try {
            const task = await tasksService.update(
                req.currentUser.id,
                req.currentUser.timezone,
                req.params.uid,
                req.body
            );
            res.json(task);
        } catch (error) {
            logError('Error updating task:', error);
            next(error);
        }
    },

    /**
     * DELETE /api/task/:uid
     */
    async delete(req, res, next) {
        try {
            const result = await tasksService.delete(req.params.uid);
            res.json(result);
        } catch (error) {
            logError('Error deleting task:', error);
            next(error);
        }
    },

    /**
     * GET /api/task/:uid/subtasks
     */
    async listSubtasks(req, res, next) {
        try {
            const subtasks = await tasksService.listSubtasks(
                req.params.uid,
                req.currentUser.id,
                req.currentUser.timezone
            );
            res.json(subtasks);
        } catch (error) {
            logError('Error fetching subtasks:', error);
            next(error);
        }
    },

    /**
     * PATCH /api/task/:uid/subtasks/reorder
     */
    async reorderSubtasks(req, res, next) {
        try {
            await tasksService.reorderSubtasks(
                req.params.uid,
                req.currentUser.id,
                req.body.subtaskIds
            );
            res.json({ success: true });
        } catch (error) {
            logError('Error reordering subtasks:', error);
            next(error);
        }
    },
    /**
     * GET /api/task/:uid/next-iterations
     */
    async nextIterations(req, res, next) {
        try {
            const iterations = await tasksService.getNextIterations(
                req.params.uid,
                req.currentUser.id,
                req.currentUser.timezone,
                req.query.startFromDate
            );
            res.json({ iterations });
        } catch (error) {
            logError('Error getting next iterations:', error);
            next(error);
        }
    },

    /**
     * POST /api/task/:uid/focus-session — log a focus/pomodoro session.
     */
    async logFocusSession(req, res, next) {
        try {
            const { TaskEvent, Task } = require('../../models');
            const { uid } = req.params;
            const { duration_sec, started_at, ended_at } = req.body;

            if (!Number.isFinite(duration_sec) || duration_sec < 1) {
                throw new ValidationError('Invalid duration_sec');
            }

            const task = await Task.findOne({ where: { uid } });
            if (!task) {
                const { NotFoundError } = require('../../shared/errors');
                throw new NotFoundError('Task not found');
            }

            await TaskEvent.create({
                task_id: task.id,
                user_id: req.currentUser.id,
                event_type: 'focus_session',
                field_name: 'focus_session',
                old_value: null,
                new_value: null,
                metadata: {
                    duration_sec,
                    started_at: started_at || null,
                    ended_at: ended_at || null,
                },
            });

            res.status(201).json({ logged: true });
        } catch (error) {
            logError('Error logging focus session:', error);
            next(error);
        }
    },

    async bulkUpdate(req, res, next) {
        try {
            const userId = req.currentUser.id;
            const tz = req.currentUser?.timezone || 'UTC';
            const result = await tasksService.bulkUpdate(userId, tz, req.body);
            res.json({ updated: result.updated, failed: result.failed });
        } catch (err) {
            next(err);
        }
    },

    async bulkDelete(req, res, next) {
        try {
            const userId = req.currentUser.id;
            const result = await tasksService.bulkDelete(userId, req.body);
            res.json({ deleted: result.deleted, failed: result.failed });
        } catch (err) {
            next(err);
        }
    },
};

module.exports = tasksController;
