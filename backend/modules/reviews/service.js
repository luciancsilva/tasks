'use strict';

const moment = require('moment-timezone');
const { Op } = require('sequelize');
const { User, Task } = require('../../models');
const { NotFoundError } = require('../../shared/errors');
const reviewsRepository = require('./repository');
const inboxRepository = require('../inbox/repository');
const projectsService = require('../projects/service');
const goalsService = require('../goals/service');

const DONE_STATUSES = [
    Task.STATUS.DONE,
    Task.STATUS.ARCHIVED,
    Task.STATUS.CANCELLED,
];
const DAY_MS = 24 * 60 * 60 * 1000;

class ReviewsService {
    async getStatus(userId) {
        const user = await User.findByPk(userId, {
            attributes: ['id', 'last_reviewed_at', 'timezone'],
        });
        if (!user) throw new NotFoundError('User not found');
        return this._buildStatus(user);
    }

    async markComplete(userId) {
        const [updated] = await reviewsRepository.setLastReviewed(
            userId,
            new Date()
        );
        if (updated === 0) throw new NotFoundError('User not found');
        return this.getStatus(userId);
    }

    async getSections(userId /* , tz */) {
        const [
            inboxCount,
            staleDays,
            allProjects,
            waitingTasks,
            somedayTasks,
            goals,
        ] = await Promise.all([
            inboxRepository.countActive(userId),
            this._getUserStaleDays(userId),
            projectsService.getAll(userId, { active: 'true' }),
            Task.findAll({
                where: {
                    user_id: userId,
                    status: Task.STATUS.WAITING,
                },
                order: [['waiting_since', 'ASC']],
                raw: true,
            }),
            Task.findAll({
                where: {
                    user_id: userId,
                    is_someday: true,
                    status: { [Op.notIn]: DONE_STATUSES },
                },
                order: [['updated_at', 'ASC']],
                raw: true,
            }),
            goalsService.getAll(userId),
        ]);

        const staleTasks = await this._findStaleTasks(userId, staleDays);

        const now = Date.now();
        const in7d = new Date(now + 7 * DAY_MS);
        const upcomingTasks = await Task.findAll({
            where: {
                user_id: userId,
                due_date: { [Op.between]: [new Date(now), in7d] },
                status: { [Op.notIn]: DONE_STATUSES },
                is_someday: { [Op.ne]: true },
            },
            order: [['due_date', 'ASC']],
            raw: true,
        });

        const stalled = (allProjects.projects || []).filter(
            (p) => p.is_stalled
        );
        const followUpOverdue = waitingTasks.filter(
            (t) =>
                t.waiting_since &&
                now - new Date(t.waiting_since).getTime() >= 7 * DAY_MS
        );

        return [
            {
                id: 'inbox',
                title_key: 'review.section.inbox',
                count: inboxCount,
                ready: true,
                items: [],
                href: '/inbox',
            },
            {
                id: 'stale',
                title_key: 'review.section.stale',
                count: staleTasks.length,
                ready: true,
                items: staleTasks.slice(0, 20).map((t) => ({
                    uid: t.uid,
                    name: t.name,
                    type: 'task',
                    href: `/task/${t.uid}`,
                    meta: {
                        days_stale: t.updated_at
                            ? Math.floor(
                                  (now - new Date(t.updated_at).getTime()) /
                                      DAY_MS
                              )
                            : null,
                    },
                })),
                href: `/tasks?type=stale&stale_days=${staleDays}`,
            },
            {
                id: 'stalled',
                title_key: 'review.section.stalled',
                count: stalled.length,
                ready: true,
                items: stalled.slice(0, 20).map((p) => ({
                    uid: p.uid,
                    name: p.name,
                    type: 'project',
                    href: `/project/${p.uid}`,
                })),
            },
            {
                id: 'waiting',
                title_key: 'review.section.waiting',
                count: waitingTasks.length,
                ready: true,
                items: waitingTasks.slice(0, 20).map((t) => ({
                    uid: t.uid,
                    name: t.name,
                    type: 'task',
                    href: `/task/${t.uid}`,
                    meta: {
                        waiting_since_days: t.waiting_since
                            ? Math.floor(
                                  (now - new Date(t.waiting_since).getTime()) /
                                      DAY_MS
                              )
                            : null,
                    },
                })),
                follow_up_overdue_count: followUpOverdue.length,
                href: '/tasks?type=waiting',
            },
            {
                id: 'someday',
                title_key: 'review.section.someday',
                count: somedayTasks.length,
                ready: true,
                items: somedayTasks.slice(0, 20).map((t) => ({
                    uid: t.uid,
                    name: t.name,
                    type: 'task',
                    href: `/task/${t.uid}`,
                })),
                href: '/tasks?type=someday',
            },
            {
                id: 'goals',
                title_key: 'review.section.goals',
                count: goals.filter((g) => g.status === 'active').length,
                ready: true,
                items: goals
                    .filter((g) => g.status === 'active')
                    .slice(0, 20)
                    .map((g) => ({
                        uid: g.uid,
                        name: g.title,
                        type: 'goal',
                        href: `/area/${g.Area?.uid || ''}`,
                        meta: {
                            horizon: g.horizon,
                            target_date: g.target_date,
                        },
                    })),
            },
            {
                id: 'upcoming',
                title_key: 'review.section.upcoming',
                count: upcomingTasks.length,
                ready: true,
                items: upcomingTasks.slice(0, 20).map((t) => ({
                    uid: t.uid,
                    name: t.name,
                    type: 'task',
                    href: `/task/${t.uid}`,
                    meta: { due_date: t.due_date },
                })),
                href: '/upcoming',
            },
        ];
    }

    async _getUserStaleDays(userId) {
        const user = await User.findByPk(userId, {
            attributes: ['stale_task_days'],
        });
        return user?.stale_task_days || 30;
    }

    async _findStaleTasks(userId, days) {
        const cutoff = new Date(Date.now() - days * DAY_MS);
        return Task.findAll({
            where: {
                user_id: userId,
                updated_at: { [Op.lt]: cutoff },
                status: { [Op.notIn]: DONE_STATUSES },
                recurring_parent_id: null,
                is_someday: { [Op.ne]: true },
                habit_mode: { [Op.ne]: true },
            },
            order: [['updated_at', 'ASC']],
            limit: 50,
            raw: true,
        });
    }

    _buildStatus(user) {
        const tz = user.timezone || 'UTC';
        const now = moment.tz(tz);
        const last = user.last_reviewed_at
            ? moment.tz(user.last_reviewed_at, tz)
            : null;
        const daysSince = last ? now.diff(last.startOf('day'), 'days') : null;
        const suggested = daysSince === null || daysSince >= 7;
        return {
            last_reviewed_at: user.last_reviewed_at,
            days_since: daysSince,
            suggested,
        };
    }
}

module.exports = new ReviewsService();
