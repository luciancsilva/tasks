# 19b — Preservação de Pessoas (`Person`) e Menções (`tasks_people`) no Backup/Restore

> **Status: EXECUTADO** em 2026-07-17 — `exportUserData` passa a incluir `people` e os vínculos de @menção (`involved_person_uids` por task, no padrão de `tag_uids`), além de `project_uid`/`parent_task_uid`/`recurring_parent_uid` nas tasks e `project_uid` nas notes. `importUserData` importa People cedo, resolve FKs via `uidToIdMap` (com fallback ao id bruto legado), reconstrói `tasks_people` e preserva `assigned_to`.
>
> **Desvios:** (1) as menções são exportadas como `involved_person_uids` por task (espelhando `tag_uids`) em vez de uma lista `task_people` separada — mais consistente com o código existente; (2) `assigned_to` (FK única de assignee → `people.uid`) também é preservado, embora o plano só citasse as menções M:N; (3) descoberto no caminho um limite pré-existente: restaurar o backup de um usuário sobre outro que já tem tags de mesmo nome colide em `UNIQUE(user_id, name)` — distinto deste plano, candidato a plano novo (`19m`).
> **Escopo:** Incluir a tabela `Person` e as menções (`tasks_people`) na rotina de exportação/importação do `backend/services/backupService.js` e resolver foreign keys (`project_id`, `parent_task_id`) exclusivamente via `uidToIdMap`.
> **Depende de:** -

## Diagnóstico
O `exportUserData` (`backend/services/backupService.js:130-163`) exporta `Area, Project, Task, Tag, Note, InboxItem, TaskEvent, View`, mas omite `Person` e `TaskPerson` (`@mentions`). No restore, o `importUserData` (`lines 402, 497, 510`) busca relacionamentos (`parent_task_id`, `project_id`) consultando IDs numéricos brutos na tabela de `Task` (`Task.findOne({ where: { id: taskData.parent_task_id } })`) em vez de mapeá-los via UIDs.

### Impacto
Backups exportados perdem 100% dos contatos cadastrados e todas as marcações de pessoas/menções em tarefas. Ao importar dados sobre um banco existente ou em outro tenant (`merge`), os IDs autoincrementados mudam, corrompendo a hierarquia de projetos e tarefas pai.

## Implementação Proposta

1. Em `backupService.js:130` (`exportUserData`):
   ```javascript
   const people = await Person.findAll({ where: { user_id: userId } });
   const taskPeople = await TaskPerson.findAll({
       include: [{ model: Task, where: { user_id: userId }, attributes: [] }]
   });
   return { ..., people, task_people: taskPeople };
   ```
2. Em `importUserData` (`lines 402+`), criar e popular o mapa `uidToIdMap.people[person.uid] = createdPerson.id` durante a importação da lista de pessoas.
3. Substituir as buscas de `parent_task_id` e `project_id` para utilizar `uidToIdMap.tasks[task.parent_task_uid]` e `uidToIdMap.projects[task.project_uid]`.
4. Reconstituir os registros de `TaskPerson` associando os IDs locais mapeados do `task_id` e `person_id`.

## Critério de Pronto
- `npm run backend:test` sem falhas.
- Adicionar teste unitário/integração em `tests/unit/services/backupService.test.js` comprovando o round-trip (exportação -> wipe -> importação) mantendo contatos e `@mentions` intactos.
