'use strict';

const routes = require('./routes');
const reviewsService = require('./service');
const reviewsRepository = require('./repository');

module.exports = { routes, reviewsService, reviewsRepository };
