'use strict';

const { Notification } = require('../../models');

class NotificationsRepository {
    constructor() {
        this.model = Notification;
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


    async getUserNotifications(userId, options) {
        return Notification.getUserNotifications(userId, options);
    }

    async getUnreadCount(userId) {
        return Notification.getUnreadCount(userId);
    }

    async markAllAsRead(userId) {
        return Notification.markAllAsRead(userId);
    }

    async findByIdAndUser(id, userId, options = {}) {
        return this.model.findOne({
            where: { id, user_id: userId, ...options },
        });
    }

    async findByUidAndUser(uid, userId, options = {}) {
        return this.model.findOne({
            where: { uid, user_id: userId, ...options },
        });
    }
}

module.exports = new NotificationsRepository();
