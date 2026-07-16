'use strict';

const { Task, RecurringCompletion } = require('../../models');
const { Op } = require('sequelize');

class HabitsRepository {
    constructor() {
        this.model = Task;
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
            where: {
                user_id: userId,
                habit_mode: true,
                status: { [Op.ne]: 3 },
            },
            order: [['created_at', 'DESC']],
        });
    }

    async findByUidAndUser(uid, userId) {
        return this.model.findOne({
            where: { uid, user_id: userId },
        });
    }

    async createHabit(userId, data) {
        return this.model.create({
            ...data,
            user_id: userId,
            habit_mode: true,
            status: 0,
        });
    }

    async findCompletions(taskId, startDate, endDate) {
        return RecurringCompletion.findAll({
            where: {
                task_id: taskId,
                skipped: false,
                completed_at: { [Op.between]: [startDate, endDate] },
            },
            order: [['completed_at', 'DESC']],
        });
    }

    async findCompletionById(completionId, taskId) {
        return RecurringCompletion.findOne({
            where: { id: completionId, task_id: taskId },
        });
    }
}

module.exports = new HabitsRepository();
