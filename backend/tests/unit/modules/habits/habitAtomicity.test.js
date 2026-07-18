'use strict';

const { Task, RecurringCompletion, User, sequelize } = require('../../../../models');
const bcrypt = require('bcrypt');

describe('habitService - logCompletion atomicity (plan 40)', () => {
    let user, habitTask;

    beforeEach(async () => {
        user = await User.create({
            email: `habit_atom_${Date.now()}@test.com`,
            password_digest: await bcrypt.hash('password123', 10),
        });

        habitTask = await Task.create({
            name: 'Test Habit',
            user_id: user.id,
            habit_mode: true,
            habit_total_completions: 0,
            habit_current_streak: 0,
            habit_best_streak: 0,
            status: 0,
        });
    });

    it('rolls back completion create when task.update fails', async () => {
        const habitService = require('../../../../modules/habits/habitService');

        // Spy on task.update to make it throw after RecurringCompletion.create
        const originalUpdate = habitTask.update.bind(habitTask);
        habitTask.update = jest.fn().mockRejectedValue(new Error('DB error'));

        await expect(habitService.logCompletion(habitTask, new Date())).rejects.toThrow('DB error');

        // The completion must NOT be persisted (transaction rolled back)
        const completions = await RecurringCompletion.findAll({
            where: { task_id: habitTask.id },
        });
        expect(completions).toHaveLength(0);

        // Restore
        habitTask.update = originalUpdate;
    });

    it('completes successfully and increments habit_total_completions', async () => {
        const habitService = require('../../../../modules/habits/habitService');
        await habitService.logCompletion(habitTask, new Date());

        const completions = await RecurringCompletion.findAll({
            where: { task_id: habitTask.id },
        });
        expect(completions).toHaveLength(1);

        const refreshed = await Task.findByPk(habitTask.id);
        expect(refreshed.habit_total_completions).toBe(1);
    });
});

describe('habitsService - deleteCompletion atomicity (plan 40)', () => {
    let user, habitTask, completion;

    beforeEach(async () => {
        user = await User.create({
            email: `habit_del_${Date.now()}@test.com`,
            password_digest: await bcrypt.hash('password123', 10),
        });

        habitTask = await Task.create({
            name: 'Delete Habit',
            user_id: user.id,
            habit_mode: true,
            habit_total_completions: 1,
            habit_current_streak: 1,
            habit_best_streak: 1,
            status: 2,
        });

        completion = await RecurringCompletion.create({
            task_id: habitTask.id,
            completed_at: new Date(),
            original_due_date: new Date(),
            skipped: false,
        });
    });

    it('rolls back completion destroy when habitsRepository.update fails', async () => {
        const habitsRepository = require('../../../../modules/habits/repository');
        const originalUpdate = habitsRepository.update.bind(habitsRepository);
        habitsRepository.update = jest.fn().mockRejectedValue(new Error('Update failed'));

        const habitsService = require('../../../../modules/habits/service');
        await expect(
            habitsService.deleteCompletion(user.id, habitTask.uid, completion.id)
        ).rejects.toThrow('Update failed');

        // completion must still exist (rollback)
        const still = await RecurringCompletion.findByPk(completion.id);
        expect(still).not.toBeNull();

        habitsRepository.update = originalUpdate;
    });

    it('deleteCompletion removes completion and updates counters', async () => {
        const habitsService = require('../../../../modules/habits/service');
        await habitsService.deleteCompletion(user.id, habitTask.uid, completion.id);

        const gone = await RecurringCompletion.findByPk(completion.id);
        expect(gone).toBeNull();

        const refreshed = await Task.findByPk(habitTask.id);
        expect(refreshed.habit_total_completions).toBe(0);
    });
});
