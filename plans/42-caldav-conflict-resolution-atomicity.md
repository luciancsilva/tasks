# 42 — Resolução de conflito CalDAV não-atômica

> **Status: PROPOSTO** — na resolução de conflito (auto e manual), o `update` da task e a gravação do sync-state/etag ficam fora de transação; falha entre os dois faz a task reaparecer como conflito/duplicada no próximo sync.
> **Esforço:** Baixo · **Natureza:** mecânico · **Modelo:** fraco (haiku)
> **Branch:** main · **Depende de:** -

## Diagnóstico

`backend/modules/caldav/sync/merge-phase.js`, ramo de auto-resolução (`:440-452`):
```
if (!dryRun) {
    await existingTask.update(resolved.taskData);              // L441
    await SyncStateRepository.createOrUpdate(                  // L443
        existingTask.id, calendar.id,
        { etag, last_modified, last_synced_at, sync_status: 'synced' }
    );
}
```
Esse par não está em transação. Já os outros ramos do mesmo arquivo —
`_updateTaskFromRemote` (`:363`) e `_createNewTask` (`:297`) — envolvem exatamente
esse par (`task.update` + `SyncStateRepository.createOrUpdate`) em transação e
documentam a invariante. O ramo de conflito é a exceção inconsistente.

Mesmo problema em `resolveConflict` (`merge-phase.js:495-497`):
```
await task.update(taskData);                                   // L495
await SyncStateRepository.resolveConflict(taskId, calendarId); // L497
```

Consequência: falha após o `update` da task deixa o etag/sync-state sem gravar → na
próxima sincronização a task volta a divergir do remoto e é remarcada como conflito
(ou duplicada), exigindo resolução manual de novo.

## Implementação Proposta

1. Envolver o par de `:441-452` em `sequelize.transaction`, passando `{ transaction: t }`
   a `existingTask.update` e a `SyncStateRepository.createOrUpdate` — espelhando
   `_updateTaskFromRemote`/`_createNewTask`.
2. Envolver `resolveConflict` (`:495-497`) do mesmo modo, passando a tx a `task.update`
   e a `SyncStateRepository.resolveConflict`.
3. Confirmar que as assinaturas de `SyncStateRepository.createOrUpdate`/`resolveConflict`
   aceitam/repassam `{ transaction }` (os ramos existentes já usam — reaproveitar).

## Critério de Pronto

- Teste: mock de `SyncStateRepository.createOrUpdate` lançando após o `update` da task
  no ramo de auto-resolução → a task **não** fica com o campo resolvido persistido
  (rollback); sync-state permanece consistente.
- Teste equivalente para `resolveConflict`.
- Suíte backend (inclui CalDAV) verde; lint dos arquivos tocados.
