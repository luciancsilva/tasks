/* eslint-env node */
const messages = {
    task_due_soon: {
        en: (p) => {
            if (p.hoursUntilDue < 1)
                return {
                    title: 'Task due soon',
                    message: `Your task "${p.name}" is due in less than 1 hour`,
                };
            if (p.hoursUntilDue < 24)
                return {
                    title: 'Task due soon',
                    message: `Your task "${p.name}" is due in ${p.hoursUntilDue} hour${p.hoursUntilDue === 1 ? '' : 's'}`,
                };
            return {
                title: 'Task due soon',
                message: `Your task "${p.name}" is due tomorrow`,
            };
        },
        pt: (p) => {
            if (p.hoursUntilDue < 1)
                return {
                    title: 'Tarefa vencendo em breve',
                    message: `Sua tarefa "${p.name}" vence em menos de 1 hora`,
                };
            if (p.hoursUntilDue < 24)
                return {
                    title: 'Tarefa vencendo em breve',
                    message: `Sua tarefa "${p.name}" vence em ${p.hoursUntilDue} hora${p.hoursUntilDue === 1 ? '' : 's'}`,
                };
            return {
                title: 'Tarefa vencendo em breve',
                message: `Sua tarefa "${p.name}" vence amanhã`,
            };
        },
    },
    task_overdue: {
        en: (p) => {
            if (p.daysOverdue === 0)
                return {
                    title: 'Task is overdue',
                    message: `Your task "${p.name}" was due today`,
                };
            if (p.daysOverdue === 1)
                return {
                    title: 'Task is overdue',
                    message: `Your task "${p.name}" was due yesterday`,
                };
            return {
                title: 'Task is overdue',
                message: `Your task "${p.name}" was due ${p.daysOverdue} days ago`,
            };
        },
        pt: (p) => {
            if (p.daysOverdue === 0)
                return {
                    title: 'Tarefa atrasada',
                    message: `Sua tarefa "${p.name}" vencia hoje`,
                };
            if (p.daysOverdue === 1)
                return {
                    title: 'Tarefa atrasada',
                    message: `Sua tarefa "${p.name}" vencia ontem`,
                };
            return {
                title: 'Tarefa atrasada',
                message: `Sua tarefa "${p.name}" vencia há ${p.daysOverdue} dias`,
            };
        },
    },
    project_due_soon: {
        en: (p) => {
            if (p.hoursUntilDue < 1)
                return {
                    title: 'Project due soon',
                    message: `Your project "${p.name}" is due in less than 1 hour`,
                };
            if (p.hoursUntilDue < 24)
                return {
                    title: 'Project due soon',
                    message: `Your project "${p.name}" is due in ${p.hoursUntilDue} hour${p.hoursUntilDue === 1 ? '' : 's'}`,
                };
            return {
                title: 'Project due soon',
                message: `Your project "${p.name}" is due tomorrow`,
            };
        },
        pt: (p) => {
            if (p.hoursUntilDue < 1)
                return {
                    title: 'Projeto vencendo em breve',
                    message: `Seu projeto "${p.name}" vence em menos de 1 hora`,
                };
            if (p.hoursUntilDue < 24)
                return {
                    title: 'Projeto vencendo em breve',
                    message: `Seu projeto "${p.name}" vence em ${p.hoursUntilDue} hora${p.hoursUntilDue === 1 ? '' : 's'}`,
                };
            return {
                title: 'Projeto vencendo em breve',
                message: `Seu projeto "${p.name}" vence amanhã`,
            };
        },
    },
    project_overdue: {
        en: (p) => {
            if (p.daysOverdue === 0)
                return {
                    title: 'Project is overdue',
                    message: `Your project "${p.name}" was due today`,
                };
            if (p.daysOverdue === 1)
                return {
                    title: 'Project is overdue',
                    message: `Your project "${p.name}" was due yesterday`,
                };
            return {
                title: 'Project is overdue',
                message: `Your project "${p.name}" was due ${p.daysOverdue} days ago`,
            };
        },
        pt: (p) => {
            if (p.daysOverdue === 0)
                return {
                    title: 'Projeto atrasado',
                    message: `Seu projeto "${p.name}" vencia hoje`,
                };
            if (p.daysOverdue === 1)
                return {
                    title: 'Projeto atrasado',
                    message: `Seu projeto "${p.name}" vencia ontem`,
                };
            return {
                title: 'Projeto atrasado',
                message: `Seu projeto "${p.name}" vencia há ${p.daysOverdue} dias`,
            };
        },
    },
    task_now_active: {
        en: (p) => ({
            title: 'Task is now active',
            message: `Your task "${p.name}" is now available to work on`,
        }),
        pt: (p) => ({
            title: 'Tarefa ativa',
            message: `Sua tarefa "${p.name}" já está disponível para trabalho`,
        }),
    },
};

function t(key, lang, params) {
    const dict = messages[key];
    if (!dict) return { title: '', message: '' };
    const locale = dict[lang] ? lang : 'en';
    return dict[locale](params);
}

module.exports = { t };
