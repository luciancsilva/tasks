'use strict';
const commentsService = require('./service');
const { requireUserId } = require('../../shared/auth-helpers');

async function list(req, res, next) {
    try {
        const userId = requireUserId(req);
        const comments = await commentsService.list(userId, req.params.uid);
        res.json({ comments });
    } catch (err) {
        next(err);
    }
}

async function create(req, res, next) {
    try {
        const userId = requireUserId(req);
        const comment = await commentsService.create(
            userId,
            req.params.uid,
            req.body.content
        );
        res.status(201).json(comment);
    } catch (err) {
        next(err);
    }
}

async function update(req, res, next) {
    try {
        const userId = requireUserId(req);
        const comment = await commentsService.update(
            userId,
            req.params.uid,
            req.body.content
        );
        res.json(comment);
    } catch (err) {
        next(err);
    }
}

async function delete_(req, res, next) {
    try {
        const userId = requireUserId(req);
        await commentsService.delete(userId, req.params.uid);
        res.status(204).end();
    } catch (err) {
        next(err);
    }
}

module.exports = { list, create, update, delete: delete_ };
