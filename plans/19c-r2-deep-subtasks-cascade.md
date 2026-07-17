# 19c — Limpeza de Anexos Órfãos no R2 em Subtarefas Profundas (`deleteWithOrphaning`)

> **Status: EXECUTADO** em 2026-07-17 — coleta recursiva de subtarefas descendentes (nível 3+) em deleteWithOrphaning garante limpeza dos anexos no R2 antes do cascade.
> **Escopo:** Alterar a coleta de subtarefas em `backend/modules/projects/repository.js:315-330` para ser recursiva (nível 3+), garantindo a remoção completa de anexos no Cloudflare R2 antes do `ON DELETE CASCADE`.
> **Depende de:** -

## Diagnóstico
O método `deleteWithOrphaning` em `projects/repository.js:320` consulta apenas subtarefas diretas de primeiro nível (`include: [{ model: Task, as: 'Subtasks' }]`).

### Impacto
Se um usuário exclui um projeto ou tarefa com profundidade maior que 2 (`Projeto -> Tarefa A -> Subtarefa A.1 -> Subtarefa A.1.1`), `allTasksToDelete` conterá apenas os IDs de A e A.1. Os anexos em `A.1.1` não são limpos no Cloudflare R2 pela função `deleteAttachmentsForTaskIds` antes do SQLite excluir as linhas em cascata. O arquivo permanece no R2 gerando custo e lixo permanente no bucket.

## Implementação Proposta

1. Em `backend/modules/projects/repository.js`, criar uma função auxiliar assíncrona recursiva `collectAllDescendantTaskIds(rootIds)` ou utilizar CTE (`WITH RECURSIVE`).
2. Exemplo em Javascript Node/Sequelize:
   ```javascript
   async function collectDescendants(taskIds, acc = []) {
       if (!taskIds || taskIds.length === 0) return acc;
       acc.push(...taskIds);
       const children = await Task.findAll({
           where: { parent_task_id: { [Op.in]: taskIds } },
           attributes: ['id'],
           raw: true
       });
       const childIds = children.map(c => c.id);
       return collectDescendants(childIds, acc);
   }
   ```
3. Passar a lista completa de IDs coletados (`allIds`) para `deleteAttachmentsForTaskIds(allIds, { transaction })`.

## Critério de Pronto
- `npm run backend:test` limpo.
- Teste em `tests/integration/task-attachments.test.js` ou em `projects/repository.test.js` criando uma árvore com 4 níveis, onde a tarefa do 4º nível possui um anexo mockado no R2 (`aws-sdk-client-mock`), verificando que o `DeleteObjectsCommand` é invocado para o anexo profundo.
