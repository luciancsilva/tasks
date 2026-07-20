'use strict';
const express = require('express');
const router = express.Router();
const commentsController = require('./controller');
const {
    requireTaskReadAccess,
    requireTaskWriteAccess,
} = require('../tasks/middleware/access');

router.get(
    '/task/:uid/comments',
    requireTaskReadAccess,
    commentsController.list
);
router.post(
    '/task/:uid/comments',
    requireTaskWriteAccess,
    commentsController.create
);
router.patch('/comment/:uid', commentsController.update);
router.delete('/comment/:uid', commentsController.delete);

module.exports = router;
