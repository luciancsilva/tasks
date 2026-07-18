> **Status: EXECUTADO** em 2026-07-18 — `logCompletion` e `deleteCompletion` envolvidos em transação e propagados em leituras; testes unitários adicionados.

# 40 — Completar/descompletar hábito não é atômico

> **Status: PROPOSTO** — `logCompletion` e `deleteCompletion` fazem duas escritas fora de transação; falha entre elas deixa contadores/streak do hábito permanentemente divergentes do número real de completions.
> **Esforço:** Baixo · **Natureza:** mecânico · **Modelo:** fraco (haiku)
> **Branch:** main · **Depende de:** -

## Diagnóstico

`backend/modules/habits/habitService.js:14-25` (`logCompletion`):
```
const completion = await RecurringCompletion.create({ ... });   // L14
const updates = await this.calculateStreakUpdates(task, completedAt);
updates.status = 2;
updates.completed_at = completedAt;
await task.update(updates);                                     // L25
```
As duas escritas (`create` da completion e `update` da task com
`habit_total_completions`/`habit_current_streak`/`habit_best_streak`) não estão em
transação. Crash/erro entre L14 e L25 grava a completion mas não atualiza os
contadores → divergência permanente.

`backend/modules/habits/service.js:59-61` (`deleteCompletion`):
```
await completion.destroy();                                     // L59
const updates = await habitService.recalculateStreaks(habit);  // L60
await habitsRepository.update(habit, updates);                  // L61
```
Mesmo problema no sentido inverso: `destroy` sem o recompute persistido deixa
`habit_total_completions`/streak inflados.

O padrão correto já existe em `backend/modules/tasks/service.js` (create/update de
task usam `sequelize.transaction` e propagam a tx aos helpers — ver planos 19a/19e).

## Implementação Proposta

1. `logCompletion`: abrir `sequelize.transaction`, passar a tx ao
   `RecurringCompletion.create(..., { transaction: t })` e ao `task.update(updates, { transaction: t })`.
   `calculateStreakUpdates` lê completions (`habitService.js:34-49`, `calculateCurrentStreak` L130) —
   passar a tx nas leituras para enxergar a completion recém-criada dentro da transação.
2. `deleteCompletion`: abrir transação envolvendo `completion.destroy({ transaction: t })`,
   `recalculateStreaks` (que lê completions em `habitService.js:56`) e
   `habitsRepository.update(habit, updates, { transaction: t })`.
3. Confirmar a assinatura de `habitsRepository.update` para aceitar/repassar
   `{ transaction }` (ajustar se necessário, sem mudar o comportamento).

## Critério de Pronto

- Teste de integração: forçar erro no segundo passo (mock do `update`/`recalculateStreaks`
  lançando) e verificar que a completion **não** fica gravada / não fica órfã (rollback).
- Teste: completar e descompletar um hábito deixa `habit_total_completions` igual ao
  `count` real de `RecurringCompletion` não-skipped.
- Suíte backend verde; lint dos arquivos tocados.
