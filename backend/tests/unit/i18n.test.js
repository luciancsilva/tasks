/* eslint-env node, jest */
const { t } = require('../../modules/notifications/i18n');

describe('Notification i18n', () => {
    describe('task_due_soon', () => {
        const p = { name: 'Test Task' };

        it('should return EN by default for missing or unsupported language', () => {
            const res = t('task_due_soon', 'es', { ...p, hoursUntilDue: 2 });
            expect(res.title).toBe('Task due soon');
            expect(res.message).toBe('Your task "Test Task" is due in 2 hours');
        });

        it('should handle < 1 hour in EN and PT', () => {
            const resEn = t('task_due_soon', 'en', { ...p, hoursUntilDue: 0 });
            expect(resEn.message).toBe(
                'Your task "Test Task" is due in less than 1 hour'
            );

            const resPt = t('task_due_soon', 'pt', { ...p, hoursUntilDue: 0 });
            expect(resPt.message).toBe(
                'Sua tarefa "Test Task" vence em menos de 1 hora'
            );
        });

        it('should handle 1 hour pluralization correctly in EN and PT', () => {
            const resEn = t('task_due_soon', 'en', { ...p, hoursUntilDue: 1 });
            expect(resEn.message).toBe(
                'Your task "Test Task" is due in 1 hour'
            );

            const resPt = t('task_due_soon', 'pt', { ...p, hoursUntilDue: 1 });
            expect(resPt.message).toBe(
                'Sua tarefa "Test Task" vence em 1 hora'
            );
        });

        it('should handle > 1 hour pluralization correctly in EN and PT', () => {
            const resEn = t('task_due_soon', 'en', { ...p, hoursUntilDue: 5 });
            expect(resEn.message).toBe(
                'Your task "Test Task" is due in 5 hours'
            );

            const resPt = t('task_due_soon', 'pt', { ...p, hoursUntilDue: 5 });
            expect(resPt.message).toBe(
                'Sua tarefa "Test Task" vence em 5 horas'
            );
        });

        it('should handle tomorrow correctly in EN and PT', () => {
            const resEn = t('task_due_soon', 'en', { ...p, hoursUntilDue: 25 });
            expect(resEn.message).toBe('Your task "Test Task" is due tomorrow');

            const resPt = t('task_due_soon', 'pt', { ...p, hoursUntilDue: 25 });
            expect(resPt.message).toBe('Sua tarefa "Test Task" vence amanhã');
        });
    });

    describe('task_overdue', () => {
        const p = { name: 'Test Task' };

        it('should handle 0 days overdue in EN and PT', () => {
            const resEn = t('task_overdue', 'en', { ...p, daysOverdue: 0 });
            expect(resEn.message).toBe('Your task "Test Task" was due today');

            const resPt = t('task_overdue', 'pt', { ...p, daysOverdue: 0 });
            expect(resPt.message).toBe('Sua tarefa "Test Task" vencia hoje');
        });

        it('should handle 1 day overdue in EN and PT', () => {
            const resEn = t('task_overdue', 'en', { ...p, daysOverdue: 1 });
            expect(resEn.message).toBe(
                'Your task "Test Task" was due yesterday'
            );

            const resPt = t('task_overdue', 'pt', { ...p, daysOverdue: 1 });
            expect(resPt.message).toBe('Sua tarefa "Test Task" vencia ontem');
        });

        it('should handle N days overdue in EN and PT', () => {
            const resEn = t('task_overdue', 'en', { ...p, daysOverdue: 5 });
            expect(resEn.message).toBe(
                'Your task "Test Task" was due 5 days ago'
            );

            const resPt = t('task_overdue', 'pt', { ...p, daysOverdue: 5 });
            expect(resPt.message).toBe(
                'Sua tarefa "Test Task" vencia há 5 dias'
            );
        });
    });
});
