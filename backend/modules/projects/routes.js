'use strict';

const express = require('express');
const multer = require('multer');
const path = require('path');
const { getConfig } = require('../../config/config');
const config = getConfig();
const router = express.Router();
const r2Service = require('../../services/r2Service');
const projectsController = require('./controller');
const { hasAccess } = require('../../middleware/authorize');
const { requireAuth } = require('../../middleware/auth');

// Configure multer to stream project image uploads to Cloudflare R2 under `projects/`.
const storage = r2Service.getUploadStorage('projects', (req, file) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    return 'project-' + uniqueSuffix + path.extname(file.originalname);
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: config.fileUploadLimitMB * 1024 * 1024,
    },
    fileFilter: function (req, file, cb) {
        const allowedTypes = /jpeg|jpg|png|gif|webp/;
        const extname = allowedTypes.test(
            path.extname(file.originalname).toLowerCase()
        );
        const mimetype = allowedTypes.test(file.mimetype);

        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Only image files are allowed!'));
        }
    },
});

// All routes require authentication (handled by app.js middleware)

// Upload project image
router.post(
    '/upload/project-image',
    requireAuth,
    upload.single('image'),
    projectsController.uploadImage
);

// List all projects
router.get('/projects', projectsController.list);

// Get a single project (requires read access)
router.get(
    '/project/:uidSlug',
    hasAccess(
        'ro',
        'project',
        (req) => projectsController.getProjectUidForAuth(req),
        { notFoundMessage: 'Project not found' }
    ),
    projectsController.getOne
);

// Create a new project
router.post('/project', projectsController.create);

// Update a project (requires write access)
router.patch(
    '/project/:uid',
    hasAccess(
        'rw',
        'project',
        (req) => projectsController.getProjectUidForAuth(req),
        { notFoundMessage: 'Project not found.' }
    ),
    projectsController.update
);

// Delete a project (requires write access)
router.delete(
    '/project/:uid',
    requireAuth,
    hasAccess(
        'rw',
        'project',
        (req) => projectsController.getProjectUidForAuth(req),
        { notFoundMessage: 'Project not found.' }
    ),
    projectsController.delete
);

module.exports = router;
