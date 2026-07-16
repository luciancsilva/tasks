'use strict';

const { View } = require('../../models');

class ViewsRepository {
    constructor() {
        this.model = View;
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

    async findAllByUser(userId) {
        return this.model.findAll({
            where: { user_id: userId },
            order: [
                ['is_pinned', 'DESC'],
                ['created_at', 'DESC'],
            ],
        });
    }

    async findPinnedByUser(userId) {
        return this.model.findAll({
            where: { user_id: userId, is_pinned: true },
            order: [['created_at', 'DESC']],
        });
    }

    async findByUidAndUser(uid, userId) {
        return this.model.findOne({
            where: { uid, user_id: userId },
        });
    }

    async createForUser(userId, data) {
        return this.model.create({ ...data, user_id: userId });
    }
}

module.exports = new ViewsRepository();
