const express = require('express');
const multer = require('multer');
const path = require('path');
const { getConfig } = require('../../config/config');
const config = getConfig();
const { TaskAttachment, Task } = require('../../models');
const { uid } = require('../../utils/uid');
const { logError } = require('../../services/logService');
const {
    validateFileType,
    getFileUrl,
} = require('../../utils/attachment-utils');
const r2Service = require('../../services/r2Service');
const { getAuthenticatedUserId } = require('../../utils/request-utils');
const permissionsService = require('../../services/permissionsService');
const {
    createResourceLimiter,
    authenticatedApiLimiter,
} = require('../../middleware/rateLimiter');

const router = express.Router();

// Best-effort removal of an already-uploaded R2 object (used to clean up when a
// request is rejected after multer-s3 has streamed the file to the bucket).
const cleanupUploadedObject = async (req) => {
    if (req.file && req.file.key) {
        await r2Service.deleteObject(req.file.key).catch(() => {});
    }
};

// Ensure authenticated
const requireAuthMiddleware = async (req, res, next) => {
    const userId = getAuthenticatedUserId(req);
    if (!userId) {
        await cleanupUploadedObject(req);
        return res.status(401).json({ error: 'Authentication required' });
    }
    req.authUserId = userId;
    next();
};

// Configure multer to stream uploads directly to Cloudflare R2 under `tasks/`.
// Object key looks like `tasks/task-<timestamp>-<rand><ext>` (parity with the
// previous on-disk stored filename), and req.file exposes { key, size, mimetype,
// originalname } after upload.
const storage = r2Service.getUploadStorage('tasks', (req, file) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    return 'task-' + uniqueSuffix + path.extname(file.originalname);
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: config.fileUploadLimitMB * 1024 * 1024,
    },
    fileFilter: function (req, file, cb) {
        if (validateFileType(file.mimetype)) {
            return cb(null, true);
        } else {
            cb(new Error('File type not allowed'));
        }
    },
});

// Upload attachment to task
router.post(
    '/upload/task-attachment',
    createResourceLimiter,
    upload.single('file'),
    requireAuthMiddleware,
    async (req, res) => {
        try {
            const { taskUid } = req.body;
            const userId = req.authUserId;

            if (!taskUid) {
                // Clean up uploaded file
                await cleanupUploadedObject(req);
                return res.status(400).json({ error: 'Task UID is required' });
            }

            // Find task
            const task = await Task.findOne({ where: { uid: taskUid } });
            if (!task) {
                // Clean up uploaded file
                await cleanupUploadedObject(req);
                return res.status(404).json({ error: 'Task not found' });
            }

            // Check if user has write access to the task (includes shared projects)
            const access = await permissionsService.getAccess(
                userId,
                'task',
                taskUid
            );
            const LEVELS = { none: 0, ro: 1, rw: 2, admin: 3 };
            if (LEVELS[access] < LEVELS.rw) {
                // Clean up uploaded file
                await cleanupUploadedObject(req);
                return res
                    .status(403)
                    .json({ error: 'Not authorized to upload to this task' });
            }

            // Check attachment count limit (20 max)
            const attachmentCount = await TaskAttachment.count({
                where: { task_id: task.id },
            });

            if (attachmentCount >= 20) {
                // Clean up uploaded file
                await cleanupUploadedObject(req);
                return res.status(400).json({
                    error: 'Maximum 20 attachments allowed per task',
                });
            }

            if (!req.file) {
                return res.status(400).json({ error: 'No file uploaded' });
            }

            // multer-s3 exposes the full object key (e.g. `tasks/task-123.pdf`);
            // stored_filename keeps only the basename for URL building.
            const storedFilename = path.basename(req.file.key);

            // Create attachment record
            const attachment = await TaskAttachment.create({
                uid: uid(),
                task_id: task.id,
                user_id: userId,
                original_filename: req.file.originalname,
                stored_filename: storedFilename,
                file_size: req.file.size,
                mime_type: req.file.mimetype,
                file_path: req.file.key,
            });

            // Re-fetch all attachments for this task, sorted by id ASC (reliable creation order).
            // If the newly created attachment is not in the first 20 (index >= 20),
            // it means we hit a race condition that exceeded the limit. Clean up and reject.
            const allAttachments = await TaskAttachment.findAll({
                where: { task_id: task.id },
                order: [['id', 'ASC']],
            });

            const index = allAttachments.findIndex(
                (att) => att.id === attachment.id
            );

            if (index === -1 || index >= 20) {
                await attachment.destroy();
                await cleanupUploadedObject(req);
                return res.status(400).json({
                    error: 'Maximum 20 attachments allowed per task',
                });
            }

            // Return attachment with file URL
            const attachmentData = {
                ...attachment.toJSON(),
                file_url: getFileUrl(storedFilename),
            };

            res.status(201).json(attachmentData);
        } catch (error) {
            logError('Error uploading attachment:', error);

            // Clean up uploaded file on error
            await cleanupUploadedObject(req);

            res.status(500).json({
                error: 'Failed to upload attachment',
                details: error.message,
            });
        }
    }
);

// Get all attachments for a task
router.get(
    '/tasks/:taskUid/attachments',
    requireAuthMiddleware,
    async (req, res) => {
        try {
            const { taskUid } = req.params;
            const userId = req.authUserId;

            // Find task
            const task = await Task.findOne({ where: { uid: taskUid } });
            if (!task) {
                return res.status(404).json({ error: 'Task not found' });
            }

            // Check if user has read access to the task (includes shared projects)
            const access = await permissionsService.getAccess(
                userId,
                'task',
                taskUid
            );
            const LEVELS = { none: 0, ro: 1, rw: 2, admin: 3 };
            if (LEVELS[access] < LEVELS.ro) {
                return res
                    .status(403)
                    .json({ error: 'Not authorized to view this task' });
            }

            // Get attachments
            const attachments = await TaskAttachment.findAll({
                where: { task_id: task.id },
                order: [['created_at', 'ASC']],
            });

            // Add file URLs
            const attachmentsWithUrls = attachments.map((att) => ({
                ...att.toJSON(),
                file_url: getFileUrl(att.stored_filename),
            }));

            res.json(attachmentsWithUrls);
        } catch (error) {
            logError('Error fetching attachments:', error);
            res.status(500).json({
                error: 'Failed to fetch attachments',
                details: error.message,
            });
        }
    }
);

// Delete an attachment
router.delete(
    '/tasks/:taskUid/attachments/:attachmentUid',
    createResourceLimiter,
    requireAuthMiddleware,
    async (req, res) => {
        try {
            const { taskUid, attachmentUid } = req.params;
            const userId = req.authUserId;

            // Find task
            const task = await Task.findOne({ where: { uid: taskUid } });
            if (!task) {
                return res.status(404).json({ error: 'Task not found' });
            }

            // Check if user has write access to the task (includes shared projects)
            const access = await permissionsService.getAccess(
                userId,
                'task',
                taskUid
            );
            const LEVELS = { none: 0, ro: 1, rw: 2, admin: 3 };
            if (LEVELS[access] < LEVELS.rw) {
                return res
                    .status(403)
                    .json({ error: 'Not authorized to modify this task' });
            }

            // Find attachment
            const attachment = await TaskAttachment.findOne({
                where: { uid: attachmentUid, task_id: task.id },
            });

            if (!attachment) {
                return res.status(404).json({ error: 'Attachment not found' });
            }

            // Delete file from R2 (file_path holds the object key)
            await r2Service.deleteObject(attachment.file_path);

            // Delete database record
            await attachment.destroy();

            res.json({ message: 'Attachment deleted successfully' });
        } catch (error) {
            logError('Error deleting attachment:', error);
            res.status(500).json({
                error: 'Failed to delete attachment',
                details: error.message,
            });
        }
    }
);

// Download an attachment
router.get(
    '/attachments/:attachmentUid/download',
    authenticatedApiLimiter,
    requireAuthMiddleware,
    async (req, res) => {
        try {
            const { attachmentUid } = req.params;
            const userId = req.authUserId;

            // Find attachment
            const attachment = await TaskAttachment.findOne({
                where: { uid: attachmentUid },
                include: [{ model: Task, required: true }],
            });

            if (!attachment) {
                return res.status(404).json({ error: 'Attachment not found' });
            }

            // Check if user has read access to the task (includes shared projects)
            const access = await permissionsService.getAccess(
                userId,
                'task',
                attachment.Task.uid
            );
            const LEVELS = { none: 0, ro: 1, rw: 2, admin: 3 };
            if (LEVELS[access] < LEVELS.ro) {
                return res
                    .status(403)
                    .json({ error: 'Not authorized to download this file' });
            }

            // Stream file from R2 (file_path holds the object key)
            let object;
            try {
                object = await r2Service.getObjectStream(attachment.file_path);
            } catch (streamError) {
                logError('Attachment object not found in R2:', streamError);
                return res.status(404).json({ error: 'File not found' });
            }

            res.setHeader(
                'Content-Type',
                object.contentType ||
                    attachment.mime_type ||
                    'application/octet-stream'
            );
            if (object.contentLength != null) {
                res.setHeader('Content-Length', object.contentLength);
            }
            res.setHeader(
                'Content-Disposition',
                `attachment; filename="${attachment.original_filename.replace(
                    /"/g,
                    ''
                )}"`
            );

            object.body.on('error', (streamError) => {
                logError('Error streaming attachment from R2:', streamError);
                if (!res.headersSent) {
                    res.status(500).end();
                } else {
                    res.destroy(streamError);
                }
            });
            object.body.pipe(res);
        } catch (error) {
            logError('Error downloading attachment:', error);
            res.status(500).json({
                error: 'Failed to download attachment',
                details: error.message,
            });
        }
    }
);

module.exports = router;
