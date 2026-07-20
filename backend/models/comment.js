'use strict';
const { DataTypes } = require('sequelize');
const { sequelize } = require('../database');
const { uid } = require('../shared/uid');

const Comment = sequelize.define(
    'Comment',
    {
        uid: { type: DataTypes.STRING, unique: true, defaultValue: uid },
        task_id: { type: DataTypes.INTEGER, allowNull: false },
        user_id: { type: DataTypes.INTEGER, allowNull: false },
        content: {
            type: DataTypes.TEXT,
            allowNull: false,
            validate: { notEmpty: true },
        },
    },
    { tableName: 'comments', underscored: true }
);

module.exports = Comment;
