const {
    sequelize,
    User,
    Area,
    Project,
    Task,
    Tag,
    Note,
    InboxItem,
    TaskEvent,
    View,
    RecurringCompletion,
    TaskAttachment,
    Person,
    Backup,
} = require('../models');
const fs = require('fs').promises;
const path = require('path');
const zlib = require('zlib');
const { promisify } = require('util');
const { getConfig } = require('../config/config');
const config = getConfig();
const packageJson = require('../../package.json');

// Promisify zlib functions
const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

/**
 * Compare two semantic versions
 * @param {string} version1 - First version (e.g., "v0.88.0-dev.1")
 * @param {string} version2 - Second version
 * @returns {number} - Returns -1 if v1 < v2, 0 if v1 === v2, 1 if v1 > v2
 */
function compareVersions(version1, version2) {
    // Remove 'v' prefix if present
    const v1 = version1.replace(/^v/, '');
    const v2 = version2.replace(/^v/, '');

    // Split into parts (major.minor.patch-prerelease)
    const parseVersion = (v) => {
        const [mainVersion, prerelease] = v.split('-');
        const [major, minor, patch] = mainVersion.split('.').map(Number);
        return { major, minor, patch, prerelease };
    };

    const parsed1 = parseVersion(v1);
    const parsed2 = parseVersion(v2);

    // Compare major, minor, patch
    if (parsed1.major !== parsed2.major) return parsed1.major - parsed2.major;
    if (parsed1.minor !== parsed2.minor) return parsed1.minor - parsed2.minor;
    if (parsed1.patch !== parsed2.patch) return parsed1.patch - parsed2.patch;

    // If versions are equal so far, check prerelease
    // No prerelease is considered greater than prerelease
    if (!parsed1.prerelease && parsed2.prerelease) return 1;
    if (parsed1.prerelease && !parsed2.prerelease) return -1;
    if (parsed1.prerelease && parsed2.prerelease) {
        return parsed1.prerelease.localeCompare(parsed2.prerelease);
    }

    return 0;
}

/**
 * Check if backup version is compatible with current app version
 * @param {string} backupVersion - Version from backup file
 * @returns {object} - { compatible: boolean, message?: string }
 */
function checkVersionCompatibility(backupVersion) {
    const currentVersion = packageJson.version;

    // If backup version is newer than current version, it's not compatible
    const comparison = compareVersions(backupVersion, currentVersion);

    if (comparison > 0) {
        return {
            compatible: false,
            message: `Cannot restore backup from newer version ${backupVersion} to current version ${currentVersion}. Please upgrade your application first.`,
        };
    }

    return { compatible: true };
}

/**
 * Resolve a foreign key during import. Prefers the portable UID mapped to the
 * freshly-imported row; falls back to the legacy raw-id lookup for older
 * backups that predate UID export. Returns the new local id or null.
 * @param {object} uidMap - map of exported uid -> newly created local id
 * @param {string|undefined} refUid - exported uid of the referenced row
 * @param {number|undefined} legacyId - exported raw id (legacy backups)
 * @param {object} Model - Sequelize model to fall back to
 * @param {object} transaction - active transaction
 * @returns {Promise<number|null>}
 */
async function resolveMappedId(uidMap, refUid, legacyId, Model, transaction) {
    if (refUid && uidMap[refUid]) {
        return uidMap[refUid];
    }
    if (legacyId) {
        const row = await Model.findOne({
            where: { id: legacyId },
            transaction,
        });
        return row ? row.id : null;
    }
    return null;
}

/**
 * Export all data for a specific user
 * @param {number} userId - The user ID to export data for
 * @returns {Promise<object>} - The backup data as JSON
 */
async function exportUserData(userId) {
    try {
        // Fetch user with all preferences (exclude sensitive data)
        const user = await User.findByPk(userId, {
            attributes: {
                exclude: [
                    'id',
                    'password_digest',
                    'email_verification_token',
                    'email_verification_token_expires_at',
                ],
            },
        });

        if (!user) {
            throw new Error('User not found');
        }

        // Fetch all user-owned entities
        const [
            areas,
            projects,
            tasks,
            tags,
            notes,
            inboxItems,
            taskEvents,
            views,
            people,
        ] = await Promise.all([
            Area.findAll({ where: { user_id: userId } }),
            Project.findAll({
                where: { user_id: userId },
                include: [
                    {
                        model: Tag,
                        through: { attributes: [] },
                        attributes: ['uid', 'name'],
                    },
                ],
            }),
            Task.findAll({
                where: { user_id: userId },
                include: [
                    {
                        model: Tag,
                        through: { attributes: [] },
                        attributes: ['uid', 'name'],
                    },
                    {
                        model: RecurringCompletion,
                        as: 'Completions',
                    },
                    {
                        model: TaskAttachment,
                        as: 'Attachments',
                    },
                    {
                        model: Person,
                        as: 'InvolvedPeople',
                        through: { attributes: [] },
                        attributes: ['uid'],
                    },
                ],
            }),
            Tag.findAll({ where: { user_id: userId } }),
            Note.findAll({
                where: { user_id: userId },
                include: [
                    {
                        model: Tag,
                        through: { attributes: [] },
                        attributes: ['uid', 'name'],
                    },
                ],
            }),
            InboxItem.findAll({ where: { user_id: userId } }),
            TaskEvent.findAll({ where: { user_id: userId } }),
            View.findAll({ where: { user_id: userId } }),
            Person.findAll({ where: { user_id: userId } }),
        ]);

        // Numeric-id -> uid maps so foreign keys are exported as stable UIDs.
        // Raw autoincrement ids are meaningless once restored into another DB.
        const projectIdToUid = new Map(projects.map((p) => [p.id, p.uid]));
        const taskIdToUid = new Map(tasks.map((t) => [t.id, t.uid]));

        // Build the backup object
        const backup = {
            version: packageJson.version,
            exported_at: new Date().toISOString(),
            user: {
                uid: user.uid,
                email: user.email,
                name: user.name,
                surname: user.surname,
                appearance: user.appearance,
                language: user.language,
                timezone: user.timezone,
                first_day_of_week: user.first_day_of_week,
                avatar_image: user.avatar_image,
                telegram_bot_token: user.telegram_bot_token,
                telegram_chat_id: user.telegram_chat_id,
                telegram_allowed_users: user.telegram_allowed_users,
                task_summary_enabled: user.task_summary_enabled,
                task_summary_frequency: user.task_summary_frequency,
                features: user.features,
                today_settings: user.today_settings,
                sidebar_settings: user.sidebar_settings,
                ui_settings: user.ui_settings,
                notification_preferences: user.notification_preferences,
            },
            data: {
                areas: areas.map((area) => area.toJSON()),
                projects: projects.map((project) => {
                    const projectData = project.toJSON();
                    // Extract tag UIDs for relationship mapping
                    projectData.tag_uids = (project.Tags || []).map(
                        (tag) => tag.uid
                    );
                    delete projectData.Tags;
                    return projectData;
                }),
                tasks: tasks.map((task) => {
                    const taskData = task.toJSON();
                    // Extract tag UIDs and related data
                    taskData.tag_uids = (task.Tags || []).map((tag) => tag.uid);
                    // Resolve foreign keys to UIDs for portable restore.
                    taskData.project_uid = task.project_id
                        ? projectIdToUid.get(task.project_id) || null
                        : null;
                    taskData.parent_task_uid = task.parent_task_id
                        ? taskIdToUid.get(task.parent_task_id) || null
                        : null;
                    taskData.recurring_parent_uid = task.recurring_parent_id
                        ? taskIdToUid.get(task.recurring_parent_id) || null
                        : null;
                    // @mention links (people) as UIDs, mirroring tag_uids.
                    taskData.involved_person_uids = (
                        task.InvolvedPeople || []
                    ).map((person) => person.uid);
                    taskData.completions = taskData.Completions || [];
                    taskData.attachments = taskData.Attachments || [];
                    delete taskData.Tags;
                    delete taskData.Completions;
                    delete taskData.Attachments;
                    delete taskData.InvolvedPeople;
                    return taskData;
                }),
                tags: tags.map((tag) => tag.toJSON()),
                people: people.map((person) => person.toJSON()),
                notes: notes.map((note) => {
                    const noteData = note.toJSON();
                    noteData.tag_uids = (note.Tags || []).map((tag) => tag.uid);
                    noteData.project_uid = note.project_id
                        ? projectIdToUid.get(note.project_id) || null
                        : null;
                    delete noteData.Tags;
                    return noteData;
                }),
                inbox_items: inboxItems.map((item) => item.toJSON()),
                task_events: taskEvents.map((event) => event.toJSON()),
                views: views.map((view) => view.toJSON()),
            },
        };

        return backup;
    } catch (error) {
        console.error('Error exporting user data:', error);
        throw error;
    }
}

/**
 * Import and restore user data from a backup
 * @param {number} userId - The user ID to import data for
 * @param {object} backupData - The backup data to import
 * @param {object} options - Import options
 * @param {boolean} options.merge - If true, merge with existing data (default: true)
 * @returns {Promise<object>} - Import statistics
 */
async function importUserData(userId, backupData, options = { merge: true }) {
    const transaction = await sequelize.transaction();

    try {
        // Validate backup data structure
        if (!backupData.version || !backupData.data) {
            throw new Error('Invalid backup data format');
        }

        // Verify user exists
        const user = await User.findByPk(userId);
        if (!user) {
            throw new Error('User not found');
        }

        const stats = {
            areas: { created: 0, skipped: 0 },
            projects: { created: 0, skipped: 0 },
            tasks: { created: 0, skipped: 0 },
            tags: { created: 0, skipped: 0 },
            people: { created: 0, skipped: 0 },
            notes: { created: 0, skipped: 0 },
            inbox_items: { created: 0, skipped: 0 },
            views: { created: 0, skipped: 0 },
        };

        // Map to track old UIDs to new IDs for foreign key relationships
        const uidToIdMap = {
            areas: {},
            projects: {},
            tasks: {},
            tags: {},
            people: {},
            peopleUids: {},
            notes: {},
        };

        // Import tags first (no dependencies)
        if (backupData.data.tags) {
            for (const tagData of backupData.data.tags) {
                let existingTag = await Tag.findOne({
                    where: { uid: tagData.uid, user_id: userId },
                    transaction,
                });
                if (!existingTag && tagData.name) {
                    existingTag = await Tag.findOne({
                        where: { name: tagData.name, user_id: userId },
                        transaction,
                    });
                }

                if (existingTag) {
                    stats.tags.skipped++;
                    uidToIdMap.tags[tagData.uid] = existingTag.id;
                } else {
                    const newTag = await Tag.create(
                        {
                            uid: tagData.uid,
                            name: tagData.name,
                            user_id: userId,
                        },
                        { transaction }
                    );
                    stats.tags.created++;
                    uidToIdMap.tags[tagData.uid] = newTag.id;
                }
            }
        }

        // Import areas (no dependencies except user)
        if (backupData.data.areas) {
            for (const areaData of backupData.data.areas) {
                const existingArea = await Area.findOne({
                    where: { uid: areaData.uid, user_id: userId },
                    transaction,
                });

                if (existingArea && options.merge) {
                    stats.areas.skipped++;
                    uidToIdMap.areas[areaData.uid] = existingArea.id;
                } else if (!existingArea) {
                    const newArea = await Area.create(
                        {
                            uid: areaData.uid,
                            name: areaData.name,
                            description: areaData.description,
                            user_id: userId,
                        },
                        { transaction }
                    );
                    stats.areas.created++;
                    uidToIdMap.areas[areaData.uid] = newArea.id;
                }
            }
        }

        // Import people (depends only on user). Must run before tasks so
        // assigned_to (FK -> people.uid) and @mention links resolve.
        if (backupData.data.people) {
            for (const personData of backupData.data.people) {
                let existingPerson = await Person.findOne({
                    where: { uid: personData.uid, user_id: userId },
                    transaction,
                });
                if (!existingPerson && personData.name) {
                    existingPerson = await Person.findOne({
                        where: { name: personData.name, user_id: userId },
                        transaction,
                    });
                }

                if (existingPerson) {
                    stats.people.skipped++;
                    uidToIdMap.people[personData.uid] = existingPerson.id;
                    uidToIdMap.peopleUids[personData.uid] = existingPerson.uid;
                } else {
                    const newPerson = await Person.create(
                        {
                            uid: personData.uid,
                            name: personData.name,
                            relationship_type: personData.relationship_type,
                            email: personData.email,
                            phone: personData.phone,
                            notes: personData.notes,
                            archived: personData.archived,
                            color: personData.color,
                            user_id: userId,
                        },
                        { transaction }
                    );
                    stats.people.created++;
                    uidToIdMap.people[personData.uid] = newPerson.id;
                    uidToIdMap.peopleUids[personData.uid] = newPerson.uid;
                }
            }
        }

        // Import projects (depends on areas)
        if (backupData.data.projects) {
            for (const projectData of backupData.data.projects) {
                const existingProject = await Project.findOne({
                    where: { uid: projectData.uid, user_id: userId },
                    transaction,
                });

                if (existingProject && options.merge) {
                    stats.projects.skipped++;
                    uidToIdMap.projects[projectData.uid] = existingProject.id;
                } else if (!existingProject) {
                    // Map area_id if it exists
                    let areaId = null;
                    if (projectData.area_id) {
                        const area = await Area.findOne({
                            where: { id: projectData.area_id },
                            transaction,
                        });
                        areaId = area ? area.id : null;
                    }

                    const newProject = await Project.create(
                        {
                            uid: projectData.uid,
                            name: projectData.name,
                            description: projectData.description,
                            pin_to_sidebar: projectData.pin_to_sidebar,
                            priority: projectData.priority,
                            due_date_at: projectData.due_date_at,
                            image_url: projectData.image_url,
                            task_show_completed:
                                projectData.task_show_completed,
                            task_sort_order: projectData.task_sort_order,
                            status: projectData.status || projectData.state,
                            user_id: userId,
                            area_id: areaId,
                        },
                        { transaction }
                    );
                    stats.projects.created++;
                    uidToIdMap.projects[projectData.uid] = newProject.id;

                    // Create project-tag relationships
                    if (
                        projectData.tag_uids &&
                        projectData.tag_uids.length > 0
                    ) {
                        const tagIds = projectData.tag_uids
                            .map((uid) => uidToIdMap.tags[uid])
                            .filter(Boolean);
                        if (tagIds.length > 0) {
                            await newProject.setTags(tagIds, { transaction });
                        }
                    }
                }
            }
        }

        // Import tasks (depends on projects, and self-referential)
        // First pass: create all tasks without parent/recurring relationships
        if (backupData.data.tasks) {
            for (const taskData of backupData.data.tasks) {
                const existingTask = await Task.findOne({
                    where: { uid: taskData.uid, user_id: userId },
                    transaction,
                });

                if (existingTask && options.merge) {
                    stats.tasks.skipped++;
                    uidToIdMap.tasks[taskData.uid] = existingTask.id;
                } else if (!existingTask) {
                    // Resolve project by UID (portable) with a fallback to the
                    // legacy raw-id lookup for backups made before UIDs existed.
                    const projectId = await resolveMappedId(
                        uidToIdMap.projects,
                        taskData.project_uid,
                        taskData.project_id,
                        Project,
                        transaction
                    );

                    // assigned_to is a Person UID (FK -> people.uid); resolve to
                    // target DB's Person UID if that person came in or merged with this backup.
                    const assignedTo =
                        taskData.assigned_to &&
                        uidToIdMap.peopleUids[taskData.assigned_to]
                            ? uidToIdMap.peopleUids[taskData.assigned_to]
                            : null;

                    const newTask = await Task.create(
                        {
                            uid: taskData.uid,
                            name: taskData.name,
                            due_date: taskData.due_date,
                            defer_until: taskData.defer_until,
                            priority: taskData.priority,
                            status: taskData.status,
                            note: taskData.note,
                            recurrence_type: taskData.recurrence_type,
                            recurrence_interval: taskData.recurrence_interval,
                            recurrence_end_date: taskData.recurrence_end_date,
                            recurrence_weekday: taskData.recurrence_weekday,
                            recurrence_weekdays: taskData.recurrence_weekdays,
                            recurrence_month_day: taskData.recurrence_month_day,
                            recurrence_week_of_month:
                                taskData.recurrence_week_of_month,
                            completion_based: taskData.completion_based,
                            order: taskData.order,
                            completed_at: taskData.completed_at,
                            user_id: userId,
                            project_id: projectId,
                            assigned_to: assignedTo,
                        },
                        { transaction }
                    );
                    stats.tasks.created++;
                    uidToIdMap.tasks[taskData.uid] = newTask.id;

                    // Create task-tag relationships
                    if (taskData.tag_uids && taskData.tag_uids.length > 0) {
                        const tagIds = taskData.tag_uids
                            .map((uid) => uidToIdMap.tags[uid])
                            .filter(Boolean);
                        if (tagIds.length > 0) {
                            await newTask.setTags(tagIds, { transaction });
                        }
                    }

                    // Re-link @mentioned people (tasks_people M:N)
                    if (
                        taskData.involved_person_uids &&
                        taskData.involved_person_uids.length > 0
                    ) {
                        const personIds = taskData.involved_person_uids
                            .map((uid) => uidToIdMap.people[uid])
                            .filter(Boolean);
                        if (personIds.length > 0) {
                            await newTask.setInvolvedPeople(personIds, {
                                transaction,
                            });
                        }
                    }

                    // Create recurring completions
                    if (
                        taskData.completions &&
                        taskData.completions.length > 0
                    ) {
                        for (const completion of taskData.completions) {
                            await RecurringCompletion.create(
                                {
                                    task_id: newTask.id,
                                    completion_date: completion.completion_date,
                                },
                                { transaction }
                            );
                        }
                    }

                    // Create task attachments
                    if (
                        taskData.attachments &&
                        taskData.attachments.length > 0
                    ) {
                        for (const attachment of taskData.attachments) {
                            await TaskAttachment.create(
                                {
                                    task_id: newTask.id,
                                    user_id: userId,
                                    file_name: attachment.file_name,
                                    file_url: attachment.file_url,
                                    file_size: attachment.file_size,
                                    file_type: attachment.file_type,
                                },
                                { transaction }
                            );
                        }
                    }
                }
            }

            // Second pass: update parent_task_id and recurring_parent_id,
            // resolved via UID (portable) with legacy raw-id fallback.
            for (const taskData of backupData.data.tasks) {
                const hasParentRef =
                    taskData.parent_task_id ||
                    taskData.recurring_parent_id ||
                    taskData.parent_task_uid ||
                    taskData.recurring_parent_uid;
                if (hasParentRef) {
                    const task = await Task.findOne({
                        where: { uid: taskData.uid, user_id: userId },
                        transaction,
                    });

                    if (task) {
                        const updates = {};

                        const parentId = await resolveMappedId(
                            uidToIdMap.tasks,
                            taskData.parent_task_uid,
                            taskData.parent_task_id,
                            Task,
                            transaction
                        );
                        if (parentId) {
                            updates.parent_task_id = parentId;
                        }

                        const recurringParentId = await resolveMappedId(
                            uidToIdMap.tasks,
                            taskData.recurring_parent_uid,
                            taskData.recurring_parent_id,
                            Task,
                            transaction
                        );
                        if (recurringParentId) {
                            updates.recurring_parent_id = recurringParentId;
                        }

                        if (Object.keys(updates).length > 0) {
                            await task.update(updates, { transaction });
                        }
                    }
                }
            }
        }

        // Import notes (depends on projects)
        if (backupData.data.notes) {
            for (const noteData of backupData.data.notes) {
                const existingNote = await Note.findOne({
                    where: { uid: noteData.uid, user_id: userId },
                    transaction,
                });

                if (existingNote && options.merge) {
                    stats.notes.skipped++;
                } else if (!existingNote) {
                    // Resolve project by UID (portable) with legacy fallback.
                    const projectId = await resolveMappedId(
                        uidToIdMap.projects,
                        noteData.project_uid,
                        noteData.project_id,
                        Project,
                        transaction
                    );

                    const newNote = await Note.create(
                        {
                            uid: noteData.uid,
                            title: noteData.title,
                            content: noteData.content,
                            color: noteData.color,
                            user_id: userId,
                            project_id: projectId,
                        },
                        { transaction }
                    );
                    stats.notes.created++;

                    // Create note-tag relationships
                    if (noteData.tag_uids && noteData.tag_uids.length > 0) {
                        const tagIds = noteData.tag_uids
                            .map((uid) => uidToIdMap.tags[uid])
                            .filter(Boolean);
                        if (tagIds.length > 0) {
                            await newNote.setTags(tagIds, { transaction });
                        }
                    }
                }
            }
        }

        // Import inbox items
        if (backupData.data.inbox_items) {
            for (const inboxData of backupData.data.inbox_items) {
                const existingInbox = await InboxItem.findOne({
                    where: { uid: inboxData.uid, user_id: userId },
                    transaction,
                });

                if (existingInbox && options.merge) {
                    stats.inbox_items.skipped++;
                } else if (!existingInbox) {
                    await InboxItem.create(
                        {
                            uid: inboxData.uid,
                            name: inboxData.name,
                            content: inboxData.content,
                            status: inboxData.status,
                            user_id: userId,
                        },
                        { transaction }
                    );
                    stats.inbox_items.created++;
                }
            }
        }

        // Import views
        if (backupData.data.views) {
            for (const viewData of backupData.data.views) {
                const existingView = await View.findOne({
                    where: { uid: viewData.uid, user_id: userId },
                    transaction,
                });

                if (existingView && options.merge) {
                    stats.views.skipped++;
                } else if (!existingView) {
                    await View.create(
                        {
                            uid: viewData.uid,
                            name: viewData.name,
                            search_query: viewData.search_query,
                            filters: viewData.filters,
                            priority: viewData.priority,
                            due: viewData.due,
                            defer: viewData.defer,
                            tags: viewData.tags,
                            extras: viewData.extras,
                            recurring: viewData.recurring,
                            is_pinned: viewData.is_pinned,
                            user_id: userId,
                        },
                        { transaction }
                    );
                    stats.views.created++;
                }
            }
        }

        await transaction.commit();
        return stats;
    } catch (error) {
        await transaction.rollback();
        console.error('Error importing user data:', error);
        throw error;
    }
}

/**
 * Validate backup data structure
 * @param {object} backupData - The backup data to validate
 * @returns {object} - Validation result with errors array
 */
function validateBackupData(backupData) {
    const errors = [];

    if (!backupData) {
        errors.push('Backup data is empty');
        return { valid: false, errors };
    }

    if (!backupData.version) {
        errors.push('Missing version field');
    }

    if (!backupData.data) {
        errors.push('Missing data field');
    }

    // Check data structure
    const requiredFields = ['areas', 'projects', 'tasks', 'tags', 'notes'];
    for (const field of requiredFields) {
        if (backupData.data && !Array.isArray(backupData.data[field])) {
            errors.push(`Invalid or missing data.${field} array`);
        }
    }

    return {
        valid: errors.length === 0,
        errors,
    };
}

/**
 * Get the backups directory path and ensure it exists
 * @returns {Promise<string>} - Path to backups directory
 */
async function getBackupsDirectory() {
    const backupsDir = getConfig().backupPath;
    try {
        await fs.access(backupsDir);
    } catch {
        await fs.mkdir(backupsDir, { recursive: true });
    }
    return backupsDir;
}

/**
 * Save backup to disk and create database record
 * @param {number} userId - The user ID
 * @param {object} backupData - The backup data
 * @returns {Promise<object>} - The created Backup record
 */
async function saveBackup(userId, backupData) {
    try {
        const backupsDir = await getBackupsDirectory();
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const fileName = `backup-user-${userId}-${timestamp}.json.gz`;
        const filePath = path.join(backupsDir, fileName);

        // Convert backup to JSON string
        const backupJson = JSON.stringify(backupData, null, 2);

        // Compress using gzip
        const compressed = await gzip(backupJson);

        // Write compressed backup to file
        await fs.writeFile(filePath, compressed);

        // Get file stats
        const stats = await fs.stat(filePath);

        // Count items in backup
        const itemCounts = {
            areas: backupData.data.areas?.length || 0,
            projects: backupData.data.projects?.length || 0,
            tasks: backupData.data.tasks?.length || 0,
            tags: backupData.data.tags?.length || 0,
            notes: backupData.data.notes?.length || 0,
            inbox_items: backupData.data.inbox_items?.length || 0,
            views: backupData.data.views?.length || 0,
        };

        // Create database record
        const backup = await Backup.create({
            user_id: userId,
            file_path: fileName, // Store relative path
            file_size: stats.size, // Compressed size
            item_counts: itemCounts,
            version: backupData.version,
        });

        // Keep only last 5 backups for this user
        await cleanOldBackups(userId);

        return backup;
    } catch (error) {
        console.error('Error saving backup:', error);
        throw error;
    }
}

/**
 * Clean old backups, keeping only the last 5 for a user
 * @param {number} userId - The user ID
 * @returns {Promise<void>}
 */
async function cleanOldBackups(userId) {
    try {
        // Get all backups for user, ordered by creation date
        const backups = await Backup.findAll({
            where: { user_id: userId },
            order: [['created_at', 'DESC']],
        });

        // If more than 5, delete the oldest ones
        if (backups.length > 5) {
            const backupsToDelete = backups.slice(5);
            const backupsDir = await getBackupsDirectory();

            for (const backup of backupsToDelete) {
                // Delete file from disk
                const filePath = path.join(backupsDir, backup.file_path);
                try {
                    await fs.unlink(filePath);
                } catch (err) {
                    console.error(
                        `Failed to delete backup file: ${filePath}`,
                        err
                    );
                }

                // Delete database record
                await backup.destroy();
            }
        }
    } catch (error) {
        console.error('Error cleaning old backups:', error);
    }
}

/**
 * List saved backups for a user
 * @param {number} userId - The user ID
 * @param {number} limit - Maximum number of backups to return (default: 5)
 * @returns {Promise<Array>} - Array of backup records
 */
async function listBackups(userId, limit = 5) {
    try {
        const backups = await Backup.findAll({
            where: { user_id: userId },
            order: [['created_at', 'DESC']],
            limit,
            attributes: [
                'id',
                'uid',
                'file_path',
                'file_size',
                'item_counts',
                'version',
                'created_at',
            ],
        });

        return backups;
    } catch (error) {
        console.error('Error listing backups:', error);
        throw error;
    }
}

/**
 * Get a specific backup by UID
 * @param {number} userId - The user ID
 * @param {string} backupUid - The backup UID
 * @returns {Promise<object>} - The backup data
 */
async function getBackup(userId, backupUid) {
    try {
        const backup = await Backup.findOne({
            where: { uid: backupUid, user_id: userId },
        });

        if (!backup) {
            throw new Error('Backup not found');
        }

        const backupsDir = await getBackupsDirectory();
        const filePath = path.join(backupsDir, backup.file_path);

        // Read backup file
        const fileBuffer = await fs.readFile(filePath);

        // Check if file is compressed (ends with .gz)
        let backupJson;
        if (backup.file_path.endsWith('.gz')) {
            // Decompress gzip
            const decompressed = await gunzip(fileBuffer);
            backupJson = decompressed.toString('utf8');
        } else {
            // Legacy uncompressed backup
            backupJson = fileBuffer.toString('utf8');
        }

        const backupData = JSON.parse(backupJson);

        return backupData;
    } catch (error) {
        console.error('Error getting backup:', error);
        throw error;
    }
}

/**
 * Delete a specific backup
 * @param {number} userId - The user ID
 * @param {string} backupUid - The backup UID
 * @returns {Promise<void>}
 */
async function deleteBackup(userId, backupUid) {
    try {
        const backup = await Backup.findOne({
            where: { uid: backupUid, user_id: userId },
        });

        if (!backup) {
            throw new Error('Backup not found');
        }

        const backupsDir = await getBackupsDirectory();
        const filePath = path.join(backupsDir, backup.file_path);

        // Delete file from disk
        try {
            await fs.unlink(filePath);
        } catch (err) {
            console.error(`Failed to delete backup file: ${filePath}`, err);
        }

        // Delete database record
        await backup.destroy();
    } catch (error) {
        console.error('Error deleting backup:', error);
        throw error;
    }
}

module.exports = {
    exportUserData,
    importUserData,
    validateBackupData,
    saveBackup,
    listBackups,
    getBackup,
    deleteBackup,
    getBackupsDirectory,
    checkVersionCompatibility,
};
