const { DataTypes } = require('sequelize');
const { uid } = require('../utils/uid');

module.exports = (sequelize) => {
    const View = sequelize.define(
        'View',
        {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            uid: {
                type: DataTypes.STRING,
                allowNull: false,
                unique: true,
                defaultValue: uid,
            },
            name: {
                type: DataTypes.STRING,
                allowNull: false,
            },
            user_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: {
                    model: 'users',
                    key: 'id',
                },
            },
            search_query: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            filters: {
                type: DataTypes.TEXT,
                allowNull: true,
                get() {
                    const rawValue = this.getDataValue('filters');
                    return rawValue ? JSON.parse(rawValue) : [];
                },
                set(value) {
                    this.setDataValue('filters', JSON.stringify(value));
                },
            },
            priority: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            // Plan 51: saved-view energy filter ('low'|'medium'|'high').
            energy: {
                type: DataTypes.STRING,
                allowNull: true,
                defaultValue: null,
            },
            // Plan 52: saved-view time-available filter, in minutes. Mirrors
            // tasks.time_estimate (only an upper bound is exposed via views).
            time_max: {
                type: DataTypes.INTEGER,
                allowNull: true,
                defaultValue: null,
            },
            due: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            defer: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            tags: {
                type: DataTypes.TEXT,
                allowNull: true,
                get() {
                    const rawValue = this.getDataValue('tags');
                    return rawValue ? JSON.parse(rawValue) : [];
                },
                set(value) {
                    this.setDataValue('tags', JSON.stringify(value));
                },
            },
            // Plan 57: saved-view OR tag filter (tasks with ANY of these tags).
            // Combined with `tags` (AND) above.
            tags_any: {
                type: DataTypes.TEXT,
                allowNull: true,
                defaultValue: null,
                get() {
                    const rawValue = this.getDataValue('tags_any');
                    return rawValue ? JSON.parse(rawValue) : [];
                },
                set(value) {
                    if (value === null || value === undefined) {
                        this.setDataValue('tags_any', null);
                    } else {
                        this.setDataValue('tags_any', JSON.stringify(value));
                    }
                },
            },
            extras: {
                type: DataTypes.TEXT,
                allowNull: true,
                get() {
                    const rawValue = this.getDataValue('extras');
                    return rawValue ? JSON.parse(rawValue) : [];
                },
                set(value) {
                    this.setDataValue('extras', JSON.stringify(value));
                },
            },
            recurring: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            is_pinned: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: false,
            },
        },
        {
            tableName: 'views',
            indexes: [
                {
                    fields: ['user_id'],
                },
                {
                    fields: ['user_id', 'is_pinned'],
                },
            ],
        }
    );

    return View;
};
