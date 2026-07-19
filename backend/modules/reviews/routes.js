'use strict';

const express = require('express');
const router = express.Router();
const reviewsController = require('./controller');

router.get('/reviews/status', reviewsController.getStatus);
router.post('/reviews/complete', reviewsController.markComplete);
router.get('/reviews/sections', reviewsController.getSections);

module.exports = router;
