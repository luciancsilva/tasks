'use strict';

const { User, Role, ApiToken } = require('../../models');

const PROFILE_ATTRIBUTES = [
    'uid',
    'email',
    'name',
    'surname',
    'appearance',
    'language',
    'timezone',
    'first_day_of_week',
    'avatar_image',
    'has_password',
    'telegram_bot_token',
    'telegram_chat_id',
    'telegram_allowed_users',
    'task_summary_enabled',
    'task_summary_frequency',
    'features',
    'today_settings',
    'sidebar_settings',
    'notification_preferences',
    'keyboard_shortcuts',
];

const PROFILE_UPDATE_ATTRIBUTES = [
    'uid',
    'email',
    'name',
    'surname',
    'appearance',
    'language',
    'timezone',
    'avatar_image',
    'telegram_bot_token',
    'telegram_chat_id',
    'telegram_allowed_users',
    'task_summary_enabled',
    'task_summary_frequency',
    'features',
    'notification_preferences',
    'keyboard_shortcuts',
];

class UsersRepository {
    constructor() {
        this.model = User;
    }

    async findById(id, options = {}) {
        return this.model.findByPk(id, options);
    }

    async findOne(where, options = {}) {
        return this.model.findOne({ where, ...options });
    }

    async findAll(where = {}, options = {}) {
        return this.model.findAll({ where, ...options });
    }

    async create(data, options = {}) {
        return this.model.create(data, options);
    }

    async update(instance, data, options = {}) {
        return instance.update(data, options);
    }

    async destroy(instance, options = {}) {
        return instance.destroy(options);
    }

    async count(where = {}, options = {}) {
        return this.model.count({ where, ...options });
    }

    async exists(where) {
        const count = await this.count(where);
        return count > 0;
    }

    /**
     * Find all users with basic attributes.
     */
    async findAllBasic() {
        return this.model.findAll({
            attributes: ['id', 'email', 'name', 'surname'],
            order: [['email', 'ASC']],
        });
    }

    /**
     * Find all roles.
     */
    async findAllRoles() {
        return Role.findAll({
            attributes: ['user_id', 'is_admin'],
        });
    }

    /**
     * Find user profile by ID.
     */
    async findProfileById(userId) {
        return this.model.findByPk(userId, {
            attributes: PROFILE_ATTRIBUTES,
        });
    }

    /**
     * Find user with password digest.
     */
    async findByIdWithPassword(userId) {
        return this.model.findByPk(userId);
    }

    /**
     * Find updated user profile.
     */
    async findUpdatedProfile(userId) {
        return this.model.findByPk(userId, {
            attributes: PROFILE_UPDATE_ATTRIBUTES,
        });
    }

    /**
     * Find all API tokens for a user.
     */
    async findApiTokens(userId) {
        return ApiToken.findAll({
            where: { user_id: userId },
            order: [['created_at', 'DESC']],
        });
    }
}

module.exports = new UsersRepository();
module.exports.PROFILE_ATTRIBUTES = PROFILE_ATTRIBUTES;
module.exports.PROFILE_UPDATE_ATTRIBUTES = PROFILE_UPDATE_ATTRIBUTES;
