# 46 — Resumo Telegram usa fuso do servidor para "hoje"

> **Status: PROPOSTO** — o range de "hoje" do resumo de tarefas é calculado no fuso do processo, não do usuário; quem está em fuso diferente do servidor recebe a janela de tarefas "de hoje"/"concluídas hoje" deslocada.
> **Esforço:** Baixo · **Natureza:** julgamento · **Modelo:** médio (sonnet)
> **Branch:** main · **Depende de:** -

## Diagnóstico

`backend/modules/tasks/taskSummaryService.js:28-34` (`createTodayDateRange`):
```
const createTodayDateRange = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);              // meia-noite no fuso do processo
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return { today, tomorrow };
};
```
Esse range é usado em `fetchDueTodayTasks` (`:156`) e `fetchCompletedTodayTasks`
(`:182`), ambos por usuário. Como o "hoje" é derivado no fuso do servidor, um usuário em
fuso diferente recebe no resumo (Telegram) as tarefas "de hoje" e "concluídas hoje" com
a janela deslocada — tarefas do dia certo somem ou aparecem as do dia errado.

O restante do app resolve o fuso por usuário (`getSafeTimezone`); este caminho não.

## Implementação Proposta

1. Passar o usuário (ou seu `timezone`) para `createTodayDateRange` e derivar
   início/fim do dia no fuso do usuário (`getSafeTimezone` + `moment-timezone`,
   consistente com as queries de "hoje" já existentes no app).
2. Ajustar `fetchDueTodayTasks`/`fetchCompletedTodayTasks` para usarem o range no fuso
   do usuário. Se o modelo grava datas em UTC, converter as bordas do dia local para UTC
   antes de comparar.

## Critério de Pronto

- Teste com `TZ` do processo ≠ fuso do usuário: o resumo inclui a tarefa cujo
  `due_date`/`completed_at` cai no dia local do usuário (e exclui a que cai no dia
  adjacente por causa do offset).
- Suíte backend verde; lint dos arquivos tocados.
