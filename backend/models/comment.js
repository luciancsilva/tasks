'use strict';
const { DataTypes } = require('sequelize');
const { uid } = require('../utils/uid');

module.exports = (sequelize) => {
    const Comment = sequelize.define('Comment', {
        uid: { type: DataTypes.STRING, unique: true, defaultValue: uid },
        task_id: { type: DataTypes.INTEGER, allowNull: false },
        user_id: { type: DataTypes.INTEGER, allowNull: false },
        content: { type: DataTypes.TEXT, allowNull: false, validate: { notEmpty: true } },
    }, { tableName: 'comments', underscored: true });

    return Comment;
};
