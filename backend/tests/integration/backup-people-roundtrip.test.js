const {
    Area,
    Project,
    Task,
    Note,
    Person,
    Tag,
    InboxItem,
    TaskEvent,
    View,
    RecurringCompletion,
} = require('../../models');
const {
    exportUserData,
    importUserData,
} = require('../../services/backupService');
const { createTestUser } = require('../helpers/testUtils');

// Covers plans/19b: Person rows and @mention links (tasks_people) must survive
// export/import, and foreign keys must be resolved by UID so the hierarchy
// stays intact when autoincrement ids differ in the target tenant.
describe('backup round-trip preserves people and @mentions (plans/19b)', () => {
    let source;
    let target;

    const wipe = async () => {
        for (const Model of [
            RecurringCompletion,
            TaskEvent,
            InboxItem,
            View,
            Note,
            Task,
            Project,
            Area,
            Person,
            Tag,
        ]) {
            await Model.destroy({ where: {}, truncate: true, cascade: true });
        }
    };

    beforeEach(async () => {
        await wipe();
        source = await createTestUser({ email: 'source@test.com' });
        // Give the target a couple of throwaway rows first so its autoincrement
        // ids do NOT line up with the source's — this is what breaks raw-id FK
        // resolution and what UID resolution must survive.
        target = await createTestUser({ email: 'target@test.com' });
        await Project.create({ name: 'filler-a', user_id: target.id });
        await Project.create({ name: 'filler-b', user_id: target.id });
        await Person.create({ name: 'filler-person', user_id: target.id });
        // Drop the auto-seeded system tags on both users: identical tag names
        // across users collide on import (separate pre-existing limitation),
        // and this test is about people/mentions, not tags.
        await Tag.destroy({ where: {}, truncate: true, cascade: true });
    });

    afterEach(async () => {
        jest.restoreAllMocks();
    });

    it('re-links people, @mentions, assignee, project and subtask by UID', async () => {
        const project = await Project.create({
            name: 'Launch',
            user_id: source.id,
        });
        const alice = await Person.create({
            name: 'Alice',
            user_id: source.id,
            relationship_type: 'colleague',
        });
        const bob = await Person.create({ name: 'Bob', user_id: source.id });

        const parent = await Task.create({
            name: 'Parent task',
            user_id: source.id,
            project_id: project.id,
            assigned_to: alice.uid,
            status: Task.STATUS.NOT_STARTED,
            priority: Task.PRIORITY.MEDIUM,
        });
        await parent.setInvolvedPeople([alice.id, bob.id]);

        const child = await Task.create({
            name: 'Child task',
            user_id: source.id,
            parent_task_id: parent.id,
            status: Task.STATUS.NOT_STARTED,
            priority: Task.PRIORITY.LOW,
        });

        const backup = await exportUserData(source.id);

        // The export must carry people and the mention/assignee/hierarchy UIDs.
        expect(backup.data.people).toHaveLength(2);
        const parentExport = backup.data.tasks.find(
            (t) => t.uid === parent.uid
        );
        expect(parentExport.involved_person_uids.sort()).toEqual(
            [alice.uid, bob.uid].sort()
        );
        expect(parentExport.assigned_to).toBe(alice.uid);
        expect(parentExport.project_uid).toBe(project.uid);
        const childExport = backup.data.tasks.find((t) => t.uid === child.uid);
        expect(childExport.parent_task_uid).toBe(parent.uid);

        // Realistic restore: the source data is gone (uids are globally unique,
        // so a restore happens into a DB without the originals). The target
        // still holds filler rows, so its fresh autoincrement ids will NOT line
        // up with the source's exported numeric ids — which is exactly what
        // raw-id FK resolution gets wrong and UID resolution must survive.
        await Task.destroy({ where: { user_id: source.id }, cascade: true });
        await Note.destroy({ where: { user_id: source.id } });
        await Project.destroy({ where: { user_id: source.id } });
        await Person.destroy({ where: { user_id: source.id } });

        // Import into the mismatched-id target tenant.
        const stats = await importUserData(target.id, backup, {
            merge: false,
        });
        expect(stats.people.created).toBe(2);

        // People restored under the target user.
        const targetAlice = await Person.findOne({
            where: { uid: alice.uid, user_id: target.id },
        });
        const targetBob = await Person.findOne({
            where: { uid: bob.uid, user_id: target.id },
        });
        expect(targetAlice).not.toBeNull();
        expect(targetAlice.relationship_type).toBe('colleague');
        expect(targetBob).not.toBeNull();

        // Parent task restored with its @mentions, assignee and project intact.
        const targetParent = await Task.findOne({
            where: { uid: parent.uid, user_id: target.id },
            include: [{ model: Person, as: 'InvolvedPeople' }],
        });
        expect(targetParent).not.toBeNull();
        expect(targetParent.assigned_to).toBe(alice.uid);

        const targetProject = await Project.findOne({
            where: { uid: project.uid, user_id: target.id },
        });
        expect(targetParent.project_id).toBe(targetProject.id);

        const mentionIds = targetParent.InvolvedPeople.map((p) => p.id).sort();
        expect(mentionIds).toEqual([targetAlice.id, targetBob.id].sort());

        // Subtask hierarchy re-pointed to the remapped parent id.
        const targetChild = await Task.findOne({
            where: { uid: child.uid, user_id: target.id },
        });
        expect(targetChild.parent_task_id).toBe(targetParent.id);
    });
});
