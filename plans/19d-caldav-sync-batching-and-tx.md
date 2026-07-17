# 19d — Batching e Transações no Sync CalDAV (`pull-phase` e `merge-phase`)

> **Status: PROPOSTO** em 2026-07-17
> **Escopo:** Evitar N+1 requisições HTTP em `pull-phase.js:238` e adicionar transações atômicas ao `merge-phase.js:299` nas operações conjuntas entre `Task` e `SyncStateRepository`.
> **Depende de:** -

## Diagnóstico
1. **N+1 HTTP Requests (`pull-phase.js:233-246`)**: Se o `PROPFIND` do servidor CalDAV não retorna o campo `calendar-data`, o código executa `for (const response of responseArray) { await this._fetchTaskData(...) }` em loop sequencial.
2. **Ausência de Transação (`merge-phase.js:299-346` e `101-102`)**: No merge de itens externos, o código executa `Task.create` seguido por `SyncStateRepository.createOrUpdate` sem transação.

### Impacto
1. Em calendários com centenas de itens, o loop HTTP sequencial exaure o timeout do event loop do Node.js ou gera `ETIMEDOUT` por rate-limit no servidor CalDAV.
2. Se `SyncStateRepository.createOrUpdate` falhar logo após `Task.create`, a tarefa fica no SQLite sem ETag vinculado. Na próxima sincronização, o CalDAV não encontra o ETag e recria a tarefa como duplicata no banco (loop infinito de duplicação).

## Implementação Proposta

1. Em `pull-phase.js`, processar as requisições em lotes paralelos usando um semáforo de concorrência (`p-limit` ou chunks de 10):
   ```javascript
   const chunkArray = (arr, size) => Array.from({ length: Math.ceil(arr.length / size) }, (v, i) => arr.slice(i * size, i * size + size));
   for (const batch of chunkArray(missingDataItems, 10)) {
       await Promise.all(batch.map(item => this._fetchTaskData(item)));
   }
   ```
2. Em `merge-phase.js:299`, agrupar a criação/alteração/destruição de tarefas com `SyncStateRepository` em um bloco `await sequelize.transaction(async (t) => { ... })`:
   ```javascript
   await sequelize.transaction(async (t) => {
       const task = await Task.create(taskPayload, { transaction: t });
       await SyncStateRepository.createOrUpdate(task.id, etag, ..., { transaction: t });
   });
   ```

## Critério de Pronto
- `npm run backend:test` sem quebras na suíte CalDAV (`tests/unit/modules/caldav/`).
- Teste simulando falha no `SyncStateRepository.createOrUpdate` e comprovando rollback total do `Task.create`.
