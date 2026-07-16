'use strict';

/**
 * Branding Module
 *
 * Instance-wide customization of the displayed application name, logos and
 * favicon, with fallback to the stock tududi branding when unset.
 *
 * Usage:
 *   const brandingModule = require('./modules/branding');
 *   app.use('/api', brandingModule.publicRoutes); // before requireAuth
 *   app.use('/api', brandingModule.adminRoutes);  // after requireAuth
 */

const { publicRoutes, adminRoutes } = require('./routes');
const brandingService = require('./service');

module.exports = {
    publicRoutes,
    adminRoutes,
    brandingService,
};
