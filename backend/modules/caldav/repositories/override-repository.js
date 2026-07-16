const { CalDAVOccurrenceOverride } = require('../../../models');

class OverrideRepository {
    constructor() {
        this.model = CalDAVOccurrenceOverride;
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


    async findByParentTaskId(parentTaskId, options = {}) {
        return this.findAll({ parent_task_id: parentTaskId }, options);
    }

    async findByCalendarId(calendarId, options = {}) {
        return this.findAll({ calendar_id: calendarId }, options);
    }

    async findByRecurrenceId(
        parentTaskId,
        calendarId,
        recurrenceId,
        options = {}
    ) {
        return this.findOne(
            {
                parent_task_id: parentTaskId,
                calendar_id: calendarId,
                recurrence_id: recurrenceId,
            },
            options
        );
    }

    async createOrUpdate(
        parentTaskId,
        calendarId,
        recurrenceId,
        overrides,
        options = {}
    ) {
        const existing = await this.findByRecurrenceId(
            parentTaskId,
            calendarId,
            recurrenceId
        );

        if (existing) {
            return this.update(existing, overrides, options);
        }

        return this.create(
            {
                parent_task_id: parentTaskId,
                calendar_id: calendarId,
                recurrence_id: recurrenceId,
                ...overrides,
            },
            options
        );
    }

    async deleteByRecurrenceId(
        parentTaskId,
        calendarId,
        recurrenceId,
        options = {}
    ) {
        const override = await this.findByRecurrenceId(
            parentTaskId,
            calendarId,
            recurrenceId
        );

        if (override) {
            return this.destroy(override, options);
        }

        return null;
    }

    async deleteAllForTask(parentTaskId, calendarId, options = {}) {
        const overrides = await this.findAll(
            { parent_task_id: parentTaskId, calendar_id: calendarId },
            options
        );

        return Promise.all(
            overrides.map((override) => this.destroy(override, options))
        );
    }
}

module.exports = new OverrideRepository();
