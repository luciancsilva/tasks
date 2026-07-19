'use strict';

const moment = require('moment-timezone');
const { User } = require('../../models');
const { NotFoundError } = require('../../shared/errors');
const reviewsRepository = require('./repository');

const SECTION_SHELL = [
    {
        id: 'inbox',
        title_key: 'review.section.inbox',
        count: null,
        items: [],
        ready: false,
    },
    {
        id: 'stale',
        title_key: 'review.section.stale',
        count: null,
        items: [],
        ready: false,
    },
    {
        id: 'stalled',
        title_key: 'review.section.stalled',
        count: null,
        items: [],
        ready: false,
    },
    {
        id: 'waiting',
        title_key: 'review.section.waiting',
        count: null,
        items: [],
        ready: false,
    },
    {
        id: 'someday',
        title_key: 'review.section.someday',
        count: null,
        items: [],
        ready: false,
    },
    {
        id: 'goals',
        title_key: 'review.section.goals',
        count: null,
        items: [],
        ready: false,
    },
    {
        id: 'upcoming',
        title_key: 'review.section.upcoming',
        count: null,
        items: [],
        ready: false,
    },
];

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
        // 54a returns shell. 54b implements aggregation reusing existing services.
        void userId;
        return SECTION_SHELL.map((s) => ({ ...s }));
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
