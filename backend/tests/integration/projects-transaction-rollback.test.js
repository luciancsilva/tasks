const { Project, Tag } = require('../../models');
const projectsService = require('../../modules/projects/service');
const projectsRepository = require('../../modules/projects/repository');
const { createTestUser } = require('../helpers/testUtils');

// Verifies the atomicity added in plans/19e: when tag linking fails during
// ProjectsService.create, the project row (and any freshly-created tag) must
// roll back instead of committing a tag-less project plus orphaned tags.
describe('ProjectsService.create transactional rollback (plans/19e)', () => {
    let testUser;

    beforeEach(async () => {
        await Project.destroy({ where: {}, truncate: true });
        await Tag.destroy({ where: {}, truncate: true });
        testUser = await createTestUser();
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('rolls back the project when tag linking fails', async () => {
        const spy = jest
            .spyOn(projectsRepository, 'createTag')
            .mockRejectedValue(new Error('injected tag failure'));

        await expect(
            projectsService.create(testUser.id, {
                name: 'Atomic project',
                tags: [{ name: 'atomic-project-tag' }],
            })
        ).rejects.toThrow('injected tag failure');

        expect(spy).toHaveBeenCalled();

        const projects = await Project.findAll({
            where: { user_id: testUser.id, name: 'Atomic project' },
        });
        expect(projects).toHaveLength(0);

        const tags = await Tag.findAll({
            where: { user_id: testUser.id, name: 'atomic-project-tag' },
        });
        expect(tags).toHaveLength(0);
    });

    it('commits the project and its tags together on success', async () => {
        const result = await projectsService.create(testUser.id, {
            name: 'Happy project',
            tags: [{ name: 'happy-project-tag' }],
        });

        expect(result.name).toBe('Happy project');

        const project = await Project.findOne({
            where: { user_id: testUser.id, name: 'Happy project' },
        });
        expect(project).not.toBeNull();

        const tags = await Tag.findAll({
            where: { user_id: testUser.id, name: 'happy-project-tag' },
        });
        expect(tags).toHaveLength(1);
    });
});
