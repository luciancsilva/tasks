'use strict';

/**
 * Cloudflare R2 (S3-compatible) storage service.
 *
 * Centralizes the S3 client, the multer-s3 upload storage engine, and the
 * object read/delete helpers used by attachment/avatar/project-image routes.
 *
 * All object keys are stored WITHOUT a leading slash, e.g. `tasks/task-123.pdf`.
 * The same key is persisted in the DB (TaskAttachment.file_path, avatar/image
 * columns) exactly as it was under the old local-disk layout, so no data
 * migration is required when switching storage backends.
 */

const path = require('path');
const {
    S3Client,
    GetObjectCommand,
    DeleteObjectCommand,
    HeadObjectCommand,
} = require('@aws-sdk/client-s3');
const multerS3 = require('multer-s3');
const { getConfig } = require('../config/config');
const { logError } = require('./logService');

let cachedClient = null;

/**
 * Lazily build (and cache) the S3 client configured for Cloudflare R2.
 * region is fixed to 'auto' and endpoint points at the R2 gateway. In tests,
 * aws-sdk-client-mock intercepts commands so real credentials are not needed.
 */
function getClient() {
    if (cachedClient) {
        return cachedClient;
    }

    const { r2 } = getConfig();

    cachedClient = new S3Client({
        region: r2.region || 'auto',
        endpoint: r2.endpoint,
        credentials:
            r2.accessKeyId && r2.secretAccessKey
                ? {
                      accessKeyId: r2.accessKeyId,
                      secretAccessKey: r2.secretAccessKey,
                  }
                : undefined,
    });

    return cachedClient;
}

/**
 * Reset the cached client. Only used by tests to re-read config/env.
 */
function _resetClient() {
    cachedClient = null;
}

function getBucket() {
    return getConfig().r2.bucket;
}

/**
 * Build a multer-s3 storage engine that stores objects under `${prefix}/`.
 *
 * @param {string} prefix         Key prefix / folder, e.g. 'tasks', 'avatars', 'projects'.
 * @param {function} filenameFn   (req, file) => basename (WITHOUT prefix). If omitted,
 *                                a `${prefix}-<timestamp>-<rand><ext>` basename is used.
 * @returns a storage engine consumable by multer({ storage }).
 */
function getUploadStorage(prefix, filenameFn) {
    return multerS3({
        s3: getClient(),
        // Resolve the bucket lazily (as a function) so the storage engine can be
        // constructed at module load even when R2 is not configured yet. This
        // prevents multer-s3 from throwing "bucket is required" at boot; an
        // unconfigured bucket instead fails cleanly on the actual upload request.
        bucket: function (req, file, cb) {
            const bucket = getBucket();
            if (!bucket) {
                return cb(
                    new Error(
                        'R2 storage is not configured: set R2_BUCKET (and R2 credentials)'
                    )
                );
            }
            cb(null, bucket);
        },
        contentType: multerS3.AUTO_CONTENT_TYPE,
        key: function (req, file, cb) {
            try {
                let basename;
                if (typeof filenameFn === 'function') {
                    basename = filenameFn(req, file);
                } else {
                    const suffix =
                        Date.now() + '-' + Math.round(Math.random() * 1e9);
                    basename = `${prefix}-${suffix}${path.extname(
                        file.originalname
                    )}`;
                }
                cb(null, `${prefix}/${basename}`);
            } catch (err) {
                cb(err);
            }
        },
    });
}

/**
 * Delete an object from R2 by key. Never throws for a missing object; returns
 * false on any error (parity with the previous best-effort disk unlink).
 *
 * @param {string} key Object key, e.g. 'tasks/task-123.pdf'.
 * @returns {Promise<boolean>}
 */
async function deleteObject(key) {
    if (!key) {
        return false;
    }
    try {
        await getClient().send(
            new DeleteObjectCommand({ Bucket: getBucket(), Key: key })
        );
        return true;
    } catch (err) {
        // Best-effort contract: never throw, but never fail silently either.
        logError(`Failed to delete R2 object '${key}':`, err);
        return false;
    }
}

/**
 * Fetch an object as a readable stream plus its metadata. Throws if the object
 * does not exist (SDK NoSuchKey), so callers should handle the rejection and
 * respond 404.
 *
 * @param {string} key Object key.
 * @returns {Promise<{ body: NodeJS.ReadableStream, contentType?: string, contentLength?: number }>}
 */
async function getObjectStream(key) {
    const response = await getClient().send(
        new GetObjectCommand({ Bucket: getBucket(), Key: key })
    );
    return {
        body: response.Body,
        contentType: response.ContentType,
        contentLength: response.ContentLength,
    };
}

/**
 * Check whether an object exists. Returns false on any error (including 404).
 *
 * @param {string} key Object key.
 * @returns {Promise<boolean>}
 */
async function objectExists(key) {
    if (!key) {
        return false;
    }
    try {
        await getClient().send(
            new HeadObjectCommand({ Bucket: getBucket(), Key: key })
        );
        return true;
    } catch (err) {
        return false;
    }
}

module.exports = {
    getClient,
    getBucket,
    getUploadStorage,
    deleteObject,
    getObjectStream,
    objectExists,
    _resetClient,
};
