const {
    calculateProjectPerms,
} = require('../../../services/permissionsCalculators');
const { User, Project, Task, Note, sequelize } = require('../../../models');
const bcrypt = require('bcrypt');

describe('permissionsCalculators', () => {
    describe('calculateProjectPerms transaction propagation', () => {
        let owner, otherUser;

        beforeEach(async () => {
            const hash = await bcrypt.hash('pass', 10);
            owner = await User.create({
                email: `owner_${Date.now()}@test.com`,
                password_digest: hash,
            });
            otherUser = await User.create({
                email: `other_${Date.now()}@test.com`,
                password_digest: hash,
            });
        });

        it('passes the active transaction to every Task.findAll and Note.findAll call made while collecting project descendants', async () => {
            const project = await Project.create({
                name: 'P1',
                user_id: owner.id,
            });
            const rootTask = await Task.create({
                name: 'Root',
                user_id: owner.id,
                project_id: project.id,
            });
            await Task.create({
                name: 'Child',
                user_id: owner.id,
                project_id: project.id,
                parent_task_id: rootTask.id,
            });
            await Note.create({
                title: 'N1',
                user_id: owner.id,
                project_id: project.id,
            });

            const taskFindAllSpy = jest.spyOn(Task, 'findAll');
            const noteFindAllSpy = jest.spyOn(Note, 'findAll');

            const action = {
                verb: 'share_grant',
                actorUserId: owner.id,
                targetUserId: otherUser.id,
                resourceType: 'project',
                resourceUid: project.uid,
                accessLevel: 'ro',
            };

            await sequelize.transaction(async (tx) => {
                await calculateProjectPerms({ tx }, action);

                // Every Task.findAll call issued during descendant collection
                // must carry the active transaction — otherwise Sequelize
                // grabs a separate pool connection and can deadlock
                // (SQLITE_BUSY) against the locks held by `tx`.
                expect(taskFindAllSpy).toHaveBeenCalled();
                for (const call of taskFindAllSpy.mock.calls) {
                    expect(call[0].transaction).toBe(tx);
                }
                expect(noteFindAllSpy).toHaveBeenCalled();
                for (const call of noteFindAllSpy.mock.calls) {
                    expect(call[0].transaction).toBe(tx);
                }
            });

            taskFindAllSpy.mockRestore();
            noteFindAllSpy.mockRestore();
        });

        it('grants inherited permissions to deeply nested subtasks under a project share', async () => {
            const project = await Project.create({
                name: 'Deep',
                user_id: owner.id,
            });
            const level1 = await Task.create({
                name: 'L1',
                user_id: owner.id,
                project_id: project.id,
            });
            const level2 = await Task.create({
                name: 'L2',
                user_id: owner.id,
                project_id: project.id,
                parent_task_id: level1.id,
            });
            const level3 = await Task.create({
                name: 'L3',
                user_id: owner.id,
                project_id: project.id,
                parent_task_id: level2.id,
            });

            const action = {
                verb: 'share_grant',
                actorUserId: owner.id,
                targetUserId: otherUser.id,
                resourceType: 'project',
                resourceUid: project.uid,
                accessLevel: 'ro',
            };

            const changes = await sequelize.transaction(async (tx) =>
                calculateProjectPerms({ tx }, action)
            );

            const taskUpsertUids = changes.upserts
                .filter((u) => u.resourceType === 'task')
                .map((u) => u.resourceUid);

            expect(taskUpsertUids).toEqual(
                expect.arrayContaining([level1.uid, level2.uid, level3.uid])
            );
        });
    });
});
