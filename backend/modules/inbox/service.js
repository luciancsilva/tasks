'use strict';

const _ = require('lodash');
const inboxRepository = require('./repository');
const { PUBLIC_ATTRIBUTES } = require('./repository');
const {
    validateContent,
    validateUid,
    validateSource,
    buildTitleFromContent,
} = require('./validation');
const { NotFoundError, ValidationError } = require('../../shared/errors');
const { processInboxItem } = require('./inboxProcessingService');
const { sequelize, InboxItem } = require('../../models');
const tasksService = require('../tasks/service');

class InboxService {
    /**
     * Get all active inbox items for a user.
     * Supports pagination if limit/offset provided.
     */
    async getAll(userId, { limit, offset } = {}) {
        const MAX_LIMIT = 100;
        const hasPagination = limit !== undefined || offset !== undefined;

        if (hasPagination) {
            const parsedLimit = Math.min(parseInt(limit, 10) || 20, MAX_LIMIT);
            const parsedOffset = parseInt(offset, 10) || 0;

            const [items, totalCount] = await Promise.all([
                inboxRepository.findAllActive(userId, {
                    limit: parsedLimit,
                    offset: parsedOffset,
                }),
                inboxRepository.countActive(userId),
            ]);

            return {
                items,
                pagination: {
                    total: totalCount,
                    limit: parsedLimit,
                    offset: parsedOffset,
                    hasMore: parsedOffset + items.length < totalCount,
                },
            };
        }

        // Return simple array for backward compatibility, capped to prevent
        // unbounded queries (no explicit pagination requested).
        return inboxRepository.findAllActive(userId, { limit: MAX_LIMIT });
    }

    /**
     * Get a single inbox item by UID.
     */
    async getByUid(userId, uid) {
        validateUid(uid);

        const item = await inboxRepository.findByUidPublic(userId, uid);

        if (!item) {
            throw new NotFoundError('Inbox item not found.');
        }

        return item;
    }

    /**
     * Create a new inbox item.
     */
    async create(userId, { content, source }) {
        const validatedContent = validateContent(content);
        const validatedSource = validateSource(source);
        const title = buildTitleFromContent(validatedContent);

        const item = await inboxRepository.createForUser(userId, {
            content: validatedContent,
            title,
            source: validatedSource,
        });

        return _.pick(item, PUBLIC_ATTRIBUTES);
    }

    /**
     * Update an inbox item.
     */
    async update(userId, uid, { content, status }) {
        validateUid(uid);

        const item = await inboxRepository.findByUid(userId, uid);

        if (!item) {
            throw new NotFoundError('Inbox item not found.');
        }

        const updateData = {};

        if (content !== undefined && content !== null) {
            const validatedContent = validateContent(content);
            updateData.content = validatedContent;
            updateData.title = buildTitleFromContent(validatedContent);
        }

        if (status !== undefined && status !== null) {
            updateData.status = status;
        }

        await inboxRepository.updateItem(item, updateData);

        return _.pick(item, PUBLIC_ATTRIBUTES);
    }

    /**
     * Soft delete an inbox item.
     */
    async delete(userId, uid) {
        validateUid(uid);

        const item = await inboxRepository.findByUid(userId, uid);

        if (!item) {
            throw new NotFoundError('Inbox item not found.');
        }

        await inboxRepository.softDelete(item);

        return { message: 'Inbox item successfully deleted' };
    }

    /**
     * Mark an inbox item as processed.
     */
    async process(userId, uid) {
        validateUid(uid);

        const item = await inboxRepository.findByUid(userId, uid);

        if (!item) {
            throw new NotFoundError('Inbox item not found.');
        }

        await inboxRepository.markProcessed(item);

        return _.pick(item, PUBLIC_ATTRIBUTES);
    }

    /**
     * Analyze text content without creating an inbox item.
     */
    analyzeText(content) {
        validateContent(content);
        return processInboxItem(content);
    }

    async bulkProcessToTasks(userId, uids, shared) {
        if (!Array.isArray(uids) || uids.length === 0)
            throw new ValidationError('uids required');
        const created = [];
        const failed = [];
        for (const uid of uids) {
            try {
                const item = await InboxItem.findOne({
                    where: { uid, user_id: userId },
                });
                if (!item) {
                    failed.push({ uid, reason: 'not found' });
                    continue;
                }
                const parsed = processInboxItem(item.content);
                // Call tasksService.create (it handles its own transaction)
                await tasksService.create(userId, 'UTC', {
                    name: parsed.cleaned_content || item.content,
                    tags: [
                        ...(parsed.parsed_tags || []),
                        ...(shared.sharedTags || []),
                    ].map((t) => (typeof t === 'string' ? { name: t } : t)),
                    project_uid:
                        parsed.parsed_projects[0] || shared.sharedProjectUid,
                    area_uid: shared.sharedAreaUid,
                    priority: parsed.parsed_priority,
                });
                await item.update({ status: 'processed' });
                created.push(uid);
            } catch (e) {
                failed.push({ uid, reason: e.message });
            }
        }
        return { created, failed };
    }

    async bulkDelete(userId, uids) {
        if (!Array.isArray(uids) || uids.length === 0)
            throw new ValidationError('uids required');
        const deleted = [];
        const failed = [];
        await sequelize.transaction(async (t) => {
            for (const uid of uids) {
                try {
                    const item = await InboxItem.findOne({
                        where: { uid, user_id: userId },
                    });
                    if (!item) {
                        failed.push({ uid, reason: 'not found' });
                        continue;
                    }
                    await item.update(
                        { status: 'deleted' },
                        { transaction: t }
                    );
                    deleted.push(uid);
                } catch (e) {
                    failed.push({ uid, reason: e.message });
                }
            }
        });
        return { deleted, failed };
    }

    async bulkMarkProcessed(userId, uids) {
        if (!Array.isArray(uids) || uids.length === 0)
            throw new ValidationError('uids required');
        const processed = [];
        const failed = [];
        await sequelize.transaction(async (t) => {
            for (const uid of uids) {
                try {
                    const item = await InboxItem.findOne({
                        where: { uid, user_id: userId },
                    });
                    if (!item) {
                        failed.push({ uid, reason: 'not found' });
                        continue;
                    }
                    await item.update(
                        { status: 'processed' },
                        { transaction: t }
                    );
                    processed.push(uid);
                } catch (e) {
                    failed.push({ uid, reason: e.message });
                }
            }
        });
        return { processed, failed };
    }

    /**
     * Plan 65: count of stale inbox items for a user.
     */
    async getStaleCount(userId) {
        const { User } = require('../../models');
        const user = await User.findByPk(userId, {
            attributes: ['inbox_stale_hours'],
        });
        const hoursThreshold = user?.inbox_stale_hours || 48;
        return inboxRepository.countStale(userId, hoursThreshold);
    }
}

module.exports = new InboxService();
