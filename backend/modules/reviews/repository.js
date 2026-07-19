'use strict';

const { User } = require('../../models');

class ReviewsRepository {
    async getUserWithReviewState(userId) {
        return User.findByPk(userId, {
            attributes: ['id', 'last_reviewed_at', 'timezone'],
        });
    }

    async setLastReviewed(userId, date) {
        return User.update(
            { last_reviewed_at: date },
            { where: { id: userId } }
        );
    }
}

module.exports = new ReviewsRepository();
