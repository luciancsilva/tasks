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

// Covers plans/19m: Restore must not fail with UNIQUE(user_id, name) constraint errors
// when target user already has a Tag or Person with the same name (e.g. system tags or
// existing contacts) but a different uid. Instead, importUserData must reuse the existing
// Tag/Person and correctly map foreign keys and relationships.
describe('backup import resolves Tag and Person name collisions (plans/19m)', () => {
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
        target = await createTestUser({ email: 'target@test.com' });
    });

    afterEach(async () => {
        jest.restoreAllMocks();
    });

    it('resolves Tag name collision across users by reusing existing tag and preserving links', async () => {
        // Create custom tag with the exact same name on both users, but distinct uids
        const sourceTag = await Tag.create({
            name: 'SharedTag',
            user_id: source.id,
        });
        const targetTag = await Tag.create({
            name: 'SharedTag',
            user_id: target.id,
        });
        expect(sourceTag.uid).not.toBe(targetTag.uid);

        // Link project, task, and note on source user to sourceTag
        const sourceProject = await Project.create({
            name: 'Tagged Project',
            user_id: source.id,
        });
        await sourceProject.setTags([sourceTag.id]);

        const sourceTask = await Task.create({
            name: 'Tagged Task',
            user_id: source.id,
            project_id: sourceProject.id,
        });
        await sourceTask.setTags([sourceTag.id]);

        const sourceNote = await Note.create({
            title: 'Tagged Note',
            content: 'Note content',
            user_id: source.id,
            project_id: sourceProject.id,
        });
        await sourceNote.setTags([sourceTag.id]);

        const backup = await exportUserData(source.id);

        // Realistic restore: clean up source data before importing into target
        // since uids are globally unique across all rows in the table.
        await Task.destroy({ where: { user_id: source.id }, cascade: true });
        await Note.destroy({ where: { user_id: source.id } });
        await Project.destroy({ where: { user_id: source.id } });
        await Tag.destroy({ where: { user_id: source.id } });

        // Import into target user who already has SharedTag (and possibly system tags of same name)
        const stats = await importUserData(target.id, backup, { merge: false });

        // Ensure no duplicate SharedTag was created
        const targetTags = await Tag.findAll({
            where: { user_id: target.id, name: 'SharedTag' },
        });
        expect(targetTags).toHaveLength(1);
        expect(targetTags[0].id).toBe(targetTag.id);
        expect(stats.tags.skipped).toBeGreaterThanOrEqual(1);

        // Verify imported project links to target's existing SharedTag
        const importedProject = await Project.findOne({
            where: { user_id: target.id, uid: sourceProject.uid },
            include: [{ model: Tag }],
        });
        expect(importedProject).not.toBeNull();
        expect(importedProject.Tags.map((t) => t.id)).toContain(targetTag.id);

        // Verify imported task links to target's existing SharedTag
        const importedTask = await Task.findOne({
            where: { user_id: target.id, uid: sourceTask.uid },
            include: [{ model: Tag }],
        });
        expect(importedTask).not.toBeNull();
        expect(importedTask.Tags.map((t) => t.id)).toContain(targetTag.id);

        // Verify imported note links to target's existing SharedTag
        const importedNote = await Note.findOne({
            where: { user_id: target.id, uid: sourceNote.uid },
            include: [{ model: Tag }],
        });
        expect(importedNote).not.toBeNull();
        expect(importedNote.Tags.map((t) => t.id)).toContain(targetTag.id);
    });

    it('resolves Person name collision across users by reusing existing person and preserving assignments and mentions', async () => {
        // Create person with exact same name on both users, but distinct uids
        const sourcePerson = await Person.create({
            name: 'Colleague Name',
            user_id: source.id,
            relationship_type: 'colleague',
        });
        const targetPerson = await Person.create({
            name: 'Colleague Name',
            user_id: target.id,
            relationship_type: 'friend',
        });
        expect(sourcePerson.uid).not.toBe(targetPerson.uid);

        // Create a task assigned to and mentioning sourcePerson
        const sourceTask = await Task.create({
            name: 'Task with Person',
            user_id: source.id,
            assigned_to: sourcePerson.uid,
        });
        await sourceTask.setInvolvedPeople([sourcePerson.id]);

        const backup = await exportUserData(source.id);

        // Realistic restore: clean up source data before importing into target
        // since uids are globally unique across all rows in the table.
        await Task.destroy({ where: { user_id: source.id }, cascade: true });
        await Person.destroy({ where: { user_id: source.id } });

        // Import into target user who already has 'Colleague Name'
        const stats = await importUserData(target.id, backup, { merge: false });

        // Ensure no duplicate Person was created
        const targetPeople = await Person.findAll({
            where: { user_id: target.id, name: 'Colleague Name' },
        });
        expect(targetPeople).toHaveLength(1);
        expect(targetPeople[0].id).toBe(targetPerson.id);
        expect(stats.people.skipped).toBeGreaterThanOrEqual(1);

        // Verify imported task resolves assignee and @mentions to targetPerson
        const importedTask = await Task.findOne({
            where: { user_id: target.id, uid: sourceTask.uid },
            include: [{ model: Person, as: 'InvolvedPeople' }],
        });
        expect(importedTask).not.toBeNull();
        expect(importedTask.assigned_to).toBe(targetPerson.uid);
        expect(importedTask.InvolvedPeople.map((p) => p.id)).toContain(
            targetPerson.id
        );
    });
});
