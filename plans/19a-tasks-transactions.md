# 19a — Transações Atômicas nas Operações de Tarefas (`tasksService`)

> **Status: EXECUTADO** em 2026-07-17 — `create` e `update` de tasks agora rodam dentro de `sequelize.transaction()`, com a transação propagada a `updateTaskTags`, `updateTaskPeople`, `createSubtasks`/`updateSubtasks` e ao cascade `parent-child`. Um erro em qualquer etapa faz rollback completo.
> **Escopo:** Garantir atomicidade na criação (`create`) e atualização (`update`) de tarefas no `backend/modules/tasks/service.js`, utilizando `sequelize.transaction()`.
> **Depende de:** -

## Desvios na execução

- **`handleParentChildOnStatusChange` foi incluído no bloco transacional** (e a
  transação propagada por `operations/parent-child.js` + `repository.updateChildren`/
  `updateChildrenWithConditions`), além dos auxiliares que o plano listou. Motivo:
  o cascade de status roda **antes** de `updateSubtasks` na ordem original (edições
  explícitas de subtarefa devem sobrepor o cascade); tirá-lo do bloco quebraria a
  ordem ou deixaria uma escrita não-transacionada no meio do bloco, arriscando
  `SQLITE_BUSY` (pool default, `busy_timeout=5000`).
- **Logging best-effort movido para pós-commit.** `logRecurringCompletion` e
  `logTaskChanges` (que engolem os próprios erros) agora rodam depois do commit,
  para não disputar o lock nem derrubar um update bem-sucedido.
- Teste: `tests/integration/tasks-transaction-rollback.test.js` (rollback com falha
  injetada em `createMany` + happy-path).

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
