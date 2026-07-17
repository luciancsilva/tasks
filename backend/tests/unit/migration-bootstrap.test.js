const fs = require('fs');
const path = require('path');
const os = require('os');
const { Sequelize } = require('sequelize');
const Umzug = require('umzug');

describe('Migration bootstrap order', () => {
    let tempFilePath;
    let sequelize;

    beforeEach(() => {
        tempFilePath = path.join(
            os.tmpdir(),
            `tududi-test-migrations-${Math.random().toString(36).slice(2)}.sqlite`
        );
    });

    afterEach(async () => {
        if (sequelize) {
            try {
                await sequelize.close();
            } catch (_) {}
            sequelize = null;
        }
        if (tempFilePath && fs.existsSync(tempFilePath)) {
            try {
                fs.unlinkSync(tempFilePath);
            } catch (_) {}
        }
    });

    it('bootstraps schema by running only migrations and checks users table has first_day_of_week', async () => {
        sequelize = new Sequelize({
            dialect: 'sqlite',
            storage: tempFilePath,
            logging: false,
        });

        const umzug = new Umzug({
            migrations: {
                path: path.join(__dirname, '../../migrations'),
                params: [sequelize.getQueryInterface(), Sequelize],
            },
            storage: 'sequelize',
            storageOptions: { sequelize },
        });

        await umzug.up({
            to: '20250622053925-add-pomodoro-enabled-to-users.js',
        });

        const queryInterface = sequelize.getQueryInterface();
        const tableInfo = await queryInterface.describeTable('users');

        expect(tableInfo).toHaveProperty('first_day_of_week');
    });
});
