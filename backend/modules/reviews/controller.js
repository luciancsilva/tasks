'use strict';

const reviewsService = require('./service');
const { getAuthenticatedUserId } = require('../../utils/request-utils');
const { UnauthorizedError } = require('../../shared/errors');

function requireUserId(req) {
    const userId = getAuthenticatedUserId(req);
    if (!userId) throw new UnauthorizedError('Authentication required');
    return userId;
}

const reviewsController = {
    async getStatus(req, res, next) {
        try {
            const userId = requireUserId(req);
            const status = await reviewsService.getStatus(userId);
            res.json(status);
        } catch (err) {
            next(err);
        }
    },

    async markComplete(req, res, next) {
        try {
            const userId = requireUserId(req);
            const updated = await reviewsService.markComplete(userId);
            res.json(updated);
        } catch (err) {
            next(err);
        }
    },

    async getSections(req, res, next) {
        try {
            const userId = requireUserId(req);
            const tz = req.currentUser?.timezone || 'UTC';
            const sections = await reviewsService.getSections(userId, tz);
            res.json({ sections });
        } catch (err) {
            next(err);
        }
    },
};

module.exports = reviewsController;
