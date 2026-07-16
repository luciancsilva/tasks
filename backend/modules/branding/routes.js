'use strict';

const express = require('express');
const multer = require('multer');
const path = require('path');
const brandingService = require('./service');
const adminService = require('../admin/service');
const r2Service = require('../../services/r2Service');
const { logError } = require('../../services/logService');
const { getAuthenticatedUserId } = require('../../utils/request-utils');

/**
 * Public router: branding is needed by the Login/Register pages, so reading
 * it (and fetching the asset binaries) must not require authentication.
 */
const publicRoutes = express.Router();

/**
 * Admin router: mutations are restricted to instance admins and registered
 * behind the global requireAuth middleware in app.js.
 */
const adminRoutes = express.Router();

// Only real image formats a browser can render as logo/favicon.
const ALLOWED_IMAGE = /jpeg|jpg|png|gif|webp|svg|ico/;
const ALLOWED_MIME =
    /image\/(jpeg|png|gif|webp|svg\+xml|x-icon|vnd\.microsoft\.icon)/;

const storage = r2Service.getUploadStorage('branding', (req, file) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const kind = brandingService.isAssetKind(req.params.kind)
        ? req.params.kind
        : 'asset';
    return `${kind}-${uniqueSuffix}${path.extname(file.originalname)}`;
});

const upload = multer({
    storage,
    limits: {
        // Logos and favicons are small; 2 MB is plenty.
        fileSize: 2 * 1024 * 1024,
    },
    fileFilter: function (req, file, cb) {
        const extname = ALLOWED_IMAGE.test(
            path.extname(file.originalname).toLowerCase()
        );
        const mimetype = ALLOWED_MIME.test(file.mimetype);
        if (extname && mimetype) {
            return cb(null, true);
        }
        cb(new Error('Only image files are allowed'));
    },
});

// Best-effort removal of an already-uploaded object when the request is
// rejected after multer-s3 streamed the file to the bucket.
const cleanupUploadedObject = async (req) => {
    if (req.file && req.file.key) {
        await r2Service.deleteObject(req.file.key).catch(() => {});
    }
};

/**
 * GET /api/branding
 * Public: current branding (all fields null when not customized).
 */
publicRoutes.get('/branding', async (req, res) => {
    try {
        res.json(await brandingService.getBranding());
    } catch (error) {
        logError('Error fetching branding:', error);
        res.status(500).json({ error: 'Failed to fetch branding' });
    }
});

/**
 * GET /api/branding/asset/:filename
 * Public: stream a branding asset (logo/favicon) from R2.
 */
publicRoutes.get('/branding/asset/:filename', async (req, res) => {
    const { filename } = req.params;

    // Single path segment only — no separators, no traversal.
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(filename)) {
        return res.status(400).json({ error: 'Invalid filename' });
    }

    try {
        const object = await r2Service.getObjectStream(
            `branding/${filename}`
        );

        res.setHeader(
            'Content-Type',
            object.contentType || 'application/octet-stream'
        );
        if (object.contentLength != null) {
            res.setHeader('Content-Length', object.contentLength);
        }
        // Assets are public and referenced from <img>/<link> tags; the CSP
        // neutralizes scripts if an admin ever uploads a hostile SVG.
        res.setHeader('Cache-Control', 'public, max-age=3600');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader(
            'Content-Security-Policy',
            "default-src 'none'; style-src 'unsafe-inline'"
        );

        object.body.on('error', (streamError) => {
            logError('Error streaming branding asset:', streamError);
            if (!res.headersSent) {
                res.status(500).end();
            } else {
                res.destroy(streamError);
            }
        });
        object.body.pipe(res);
    } catch (error) {
        res.status(404).json({ error: 'Asset not found' });
    }
});

/**
 * PUT /api/branding
 * Admin: set/clear the custom application name.
 */
adminRoutes.put('/branding', async (req, res, next) => {
    try {
        await adminService.verifyAdmin(getAuthenticatedUserId(req));
        const branding = await brandingService.setAppName(req.body.app_name);
        res.json(branding);
    } catch (error) {
        if (error.status === 400) {
            return res.status(400).json({ error: error.message });
        }
        next(error);
    }
});

/**
 * POST /api/branding/asset/:kind   (kind: logo_light | logo_dark | favicon)
 * Admin: upload a branding asset. Replaces (and deletes) any previous one.
 */
adminRoutes.post(
    '/branding/asset/:kind',
    (req, res, next) => {
        if (!brandingService.isAssetKind(req.params.kind)) {
            return res.status(400).json({ error: 'Invalid asset kind' });
        }
        next();
    },
    upload.single('file'),
    async (req, res, next) => {
        try {
            await adminService.verifyAdmin(getAuthenticatedUserId(req));
        } catch (error) {
            await cleanupUploadedObject(req);
            return next(error);
        }

        try {
            if (!req.file) {
                return res.status(400).json({ error: 'No file uploaded' });
            }
            const branding = await brandingService.setAsset(
                req.params.kind,
                req.file.key
            );
            res.status(201).json(branding);
        } catch (error) {
            logError('Error uploading branding asset:', error);
            await cleanupUploadedObject(req);
            res.status(500).json({ error: 'Failed to upload asset' });
        }
    }
);

/**
 * DELETE /api/branding/asset/:kind
 * Admin: remove a branding asset and fall back to the default.
 */
adminRoutes.delete('/branding/asset/:kind', async (req, res, next) => {
    try {
        if (!brandingService.isAssetKind(req.params.kind)) {
            return res.status(400).json({ error: 'Invalid asset kind' });
        }
        await adminService.verifyAdmin(getAuthenticatedUserId(req));
        const branding = await brandingService.clearAsset(req.params.kind);
        res.json(branding);
    } catch (error) {
        next(error);
    }
});

module.exports = { publicRoutes, adminRoutes };
