# 19a — Transações Atômicas nas Operações de Tarefas (`tasksService`)

> **Status: PROPOSTO** em 2026-07-17
> **Escopo:** Garantir atomicidade na criação (`create`) e atualização (`update`) de tarefas no `backend/modules/tasks/service.js`, utilizando `sequelize.transaction()`.
> **Depende de:** -

## Diagnóstico
As operações multi-etapa em `backend/modules/tasks/service.js:385-389` (`create`) e `service.js:533-561` (`update`) modificam a tabela `tasks`, atualizam tags (`updateTaskTags`), pessoas (`updateTaskPeople`) e criam/alteram subtarefas (`createSubtasks`/`updateSubtasks`) de forma independente, sem uma transação de banco de dados.

### Impacto
Se `createSubtasks` falhar (linha 388) por erro de validação ou constraint, a tarefa e as tags já foram commitadas no SQLite, deixando um registro órfão/incompleto. Em `update` (linha 533), se a atualização de subtarefas falhar no meio (linha 561), a repetição (`RecurringCompletion.create`) e o avanço da data (`task.update`) já ocorreram irreversivelmente no banco.

## Implementação Proposta

1. Em `backend/modules/tasks/service.js:385` (`create`):
   ```javascript
   return sequelize.transaction(async (t) => {
       const task = await taskRepository.create(taskData, { transaction: t });
       await updateTaskTags(task, tagsData, { transaction: t });
       await updateTaskPeople(task, peopleData, { transaction: t });
       await createSubtasks(task, subtasksData, userId, { transaction: t });
       return task;
   });
   ```
2. Em `backend/modules/tasks/service.js:533` (`update`):
   ```javascript
   return sequelize.transaction(async (t) => {
       await task.update(updateData, { transaction: t });
       if (isRecurringCompletion) {
           await RecurringCompletion.create(..., { transaction: t });
       }
       await updateTaskTags(task, tagsData, { transaction: t });
       await updateTaskPeople(task, peopleData, { transaction: t });
       await updateSubtasks(task, subtasksData, userId, { transaction: t });
       return task;
   });
   ```
3. Atualizar as funções auxiliares `updateTaskTags`, `updateTaskPeople`, `createSubtasks` e `updateSubtasks` para repassar o parâmetro `{ transaction: options.transaction || t }` em todas as chamadas `bulkCreate`, `destroy` e `update`.

## Critério de Pronto
- Executar `npm run backend:test:unit` e `npx cross-env NODE_ENV=test npx jest tests/unit/modules/tasks/` sem regressões.
- Teste de integração verificando que um erro injetado em `createSubtasks` faz o rollback completo da tarefa principal e suas tags.
