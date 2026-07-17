# 19l — `SyncStateRepository.deleteByTaskId` não existe (deleção CalDAV quebra em runtime)

> **Status: PROPOSTO** em 2026-07-17
> **Escopo:** Implementar `deleteByTaskId(taskId, options = {})` em `backend/modules/caldav/repositories/sync-state-repository.js` e envolver os dois pontos de deleção (`merge-phase.js:100-102` e `push-phase.js:266,280`) em transação, fechando a lacuna deixada explícita pelo `19d`.
> **Depende de:** -
> **Origem:** descoberto durante a execução do `19d` (ver §Desvio naquele plano).

## Diagnóstico

`SyncStateRepository` **não define** `deleteByTaskId`, mas ele é chamado em três lugares:

- `backend/modules/caldav/sync/merge-phase.js:102` — `_handleDeletion`, quando o servidor remoto apagou uma tarefa (`existingTask.destroy()` seguido de `SyncStateRepository.deleteByTaskId(existingTask.id)`).
- `backend/modules/caldav/sync/push-phase.js:266` — após deletar a tarefa no servidor remoto.
- `backend/modules/caldav/sync/push-phase.js:280` — no caminho `404` (já deletada remotamente).

Confirmação: `NODE_ENV=test node -e "require('./modules/caldav/repositories/sync-state-repository').deleteByTaskId"` → `undefined`. Os métodos existentes de deleção são `destroy(instance, options)` e `deleteByCalendarId(calendarId, options)` (`sync-state-repository.js:201`); há um `findByTaskId(taskId, options)` (`:41`).

### Impacto

Qualquer sync que envolva **deleção** de tarefa (remota→local em `merge-phase`, ou local→remota em `push-phase`) lança `TypeError: SyncStateRepository.deleteByTaskId is not a function`. No `merge-phase`, o `execute()` engole o erro por item (`try/catch` que empurra para `results.errors`), mas a linha `sync_state` órfã **nunca é removida** — a tarefa foi apagada e o `CalDAVSyncState` fica apontando para um `task_id` inexistente, poluindo o estado de sync e podendo recriar/conflitar na próxima rodada. No `push-phase`, derruba a fase de push.

Além disso, `existingTask.destroy()` + limpeza do sync-state em `merge-phase.js:100-102` roda **sem transação** (mesma classe de bug que o `19d` fechou para create/update) — o `19d` deixou este ponto de fora justamente porque o método não existe.

## Implementação Proposta

1. Em `sync-state-repository.js`, implementar, no padrão de `deleteByCalendarId`:
   ```javascript
   async deleteByTaskId(taskId, options = {}) {
       const syncStates = await this.findByTaskId(taskId, options);
       await Promise.all(syncStates.map((state) => this.delete(state, options)));
       return syncStates.length;
   }
   ```
   (Conferir se o método de deleção de instância é `destroy` ou `delete` no arquivo — usar o que existir; `destroy(instance, options)` está em `:28`.)
2. Em `merge-phase.js:100-102`, envolver `existingTask.destroy()` + `SyncStateRepository.deleteByTaskId(...)` em `await sequelize.transaction(async (t) => { ... })`, passando `{ transaction: t }` para os dois (fecha o item que o `19d` deixou pendente).
3. Em `push-phase.js:266,280`, passar a transação se o entorno já tiver uma; caso contrário, ao menos garantir a chamada correta ao método agora existente.

## Critério de Pronto

- `npm run backend:test` limpo (baseline atual: 122 suítes / 1683 verdes).
- Teste em `tests/integration/` (ou unit em `tests/unit/modules/caldav/`) que sincroniza uma deleção remota de tarefa e verifica que (a) a tarefa é apagada, (b) o `CalDAVSyncState` correspondente some, (c) nenhum `TypeError` é lançado. Simular falha no `deleteByTaskId` e comprovar rollback do `destroy` no `merge-phase`.
