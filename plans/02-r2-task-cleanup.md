# Frente 2 — Anexos de tarefa órfãos no R2 ao deletar a tarefa inteira

## Diagnóstico

### Fluxo que funciona (referência)

`DELETE /api/tasks/:taskUid/attachments/:attachmentUid` — `backend/modules/tasks/attachments.js:211-263`:

```js
await r2Service.deleteObject(attachment.file_path); // file_path = key R2 ('tasks/task-...ext')
await attachment.destroy();
```

Padrão: deletar objeto no R2 primeiro (best-effort, nunca lança), depois o registro.

### Fluxo quebrado

`DELETE /api/task/:uid` — `backend/modules/tasks/routes.js:916-984`. O handler:
1. Trata instâncias recorrentes filhas (deleta futuras, desvincula passadas) — linhas 926-957.
2. `PRAGMA foreign_keys = OFF`, deleta `TaskEvent`, `tasks_tags` via SQL cru, `clearRecurringParent`, e `task.destroy({ force: true })` — linhas 959-976.

**Nenhuma menção a `TaskAttachment` nem a `r2Service`.** É ausência total de chamada. Como o handler desliga `PRAGMA foreign_keys` antes do destroy, nem cascade de FK roda — as linhas de `task_attachments` ficam órfãs no banco **e** os objetos ficam órfãos no R2.

Agravante: subtasks. `Task.hasMany(Task, { as: 'Subtasks', foreignKey: 'parent_task_id' })` (`backend/models/index.js:138-150`). Subtasks podem ter anexos próprios; o delete do pai não os considera.

Existe já um precedente correto de limpeza em massa: `projectsRepository.deleteWithOrphaning` (`backend/modules/projects/repository.js:290-312`) itera anexos de tasks e subtasks chamando `r2Service.deleteObject` + `attachment.destroy()`.

## Correção proposta

1. **Helper reutilizável** `deleteAttachmentsForTaskIds(taskIds, options)` em novo arquivo `backend/modules/tasks/attachmentCleanup.js` (ou em `utils/`):
   - `TaskAttachment.findAll({ where: { task_id: taskIds } })`;
   - para cada: `r2Service.deleteObject(att.file_path)` (best-effort) + `att.destroy()`;
   - aceita `transaction` opcional para o destroy.
2. **No handler `DELETE /task/:uid`**: antes do bloco de destroy, coletar `taskId` + ids das subtasks (`Task.findAll({ where: { parent_task_id: taskId } })`) + ids das instâncias recorrentes futuras que serão destruídas, e chamar o helper.
3. **Refatorar `projectsRepository.deleteWithOrphaning`** para usar o mesmo helper (reuso, conecta com a Frente 1).
4. Não usar hook `beforeDestroy` no model `Task` — mesmos motivos da Frente 1 (destroy em lote não dispara hook por instância; side effect HTTP dentro de transação).

### Riscos de regressão considerados

- Instâncias recorrentes passadas são **preservadas** (viram standalone) — não deletar anexos delas.
- Instâncias futuras são destruídas via `futureInstance.destroy()` — anexos delas (se existirem) também devem ser limpos.
- Subtasks: um nível de profundidade (o modelo só suporta um nível — subtask não tem subtask própria no fluxo de criação).
- R2 fora do ar não pode impedir a deleção da tarefa (contrato best-effort de `deleteObject` preservado).

## Testes

Em `backend/tests/integration/task-attachments.test.js` (já usa `aws-sdk-client-mock`):
- DELETE da tarefa com 2 anexos → 2 `DeleteObjectCommand` com as keys corretas + registros `task_attachments` removidos.
- DELETE de tarefa cujo subtask tem anexo → anexo do subtask limpo também.
- DELETE de tarefa sem anexos → nenhum `DeleteObjectCommand`.
