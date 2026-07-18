# 44 — Jobs de notificação: N+1 e `findAll` sem teto

> **Status: EXECUTADO** em 2026-07-18 — paginação no findAll e indexação de notificações adicionadas para evitar saturação no scheduler e memory leaks.
> **Esforço:** Médio · **Natureza:** julgamento · **Modelo:** médio (sonnet)
> **Branch:** main · **Depende de:** -

## Diagnóstico

`backend/modules/tasks/dueTaskService.js`:
- `:25` `Task.findAll` de todas as tasks com `due_date <= amanhã` e `status ≠ 2`, de
  **todos os usuários**, sem `limit`.
- `:74` dentro do `for (const task of dueTasks)`, `Notification.findAll` por task
  (janela de 2 dias). N tasks devidas = N queries.

`backend/modules/tasks/deferredTaskService.js`:
- `:14` `Task.findAll` sem `limit` (todas com `defer_until <= agora+5min`).
- `:55` `Notification.findAll` por task dentro do loop.

`backend/modules/caldav/sync/push-phase.js`:
- `:104` `_findLocalChanges` faz `Task.findAll({ where: { user_id } })` (todas as tasks
  do usuário, sem limit) e filtra em memória (`:110-114`).
- `:102` `syncedTaskIds` é computado e **nunca usado** (código morto).

Os schedulers rodam periodicamente (ciclo ~15 min). Com base grande, cada ciclo carrega
todas as tasks na memória e dispara centenas/milhares de queries de notificação,
prolongando locks no SQLite (WAL) e concorrendo com requests de usuário.

## Implementação Proposta

1. `dueTaskService`/`deferredTaskService`: substituir o `Notification.findAll` por-task
   por **uma** query por ciclo que traz as notificações recentes relevantes (por
   `type` + janela), agrupadas em memória por `taskUid` — a lógica de match já usa
   `notif.data?.taskUid` (dueTask `:86-90`, deferred `:65-69`), então basta indexar o
   resultado uma vez.
2. Adicionar teto/paginação ao `Task.findAll` dos dois jobs (processar em lotes) para
   não materializar a tabela inteira.
3. `push-phase.js`: remover `syncedTaskIds` morto (`:102`); avaliar paginar/limitar o
   `Task.findAll` do `_findLocalChanges` ou restringir por `updated_at` desde o último
   sync, se houver marca disponível no sync-state.

## Critério de Pronto

- Teste: com N tasks devidas, o job faz um número **constante** de queries de
  notificação (não O(N)).
- Comportamento de notificação preservado (dedup por task/tipo, respeito a dismissed/read
  como hoje em dueTask `:95-99` e deferred `:74-90`).
- `syncedTaskIds` removido sem alterar o resultado de `_findLocalChanges`.
- Suíte backend verde; lint dos arquivos tocados.
