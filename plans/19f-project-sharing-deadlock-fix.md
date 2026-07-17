# 19f — Propagação de `transaction: ctx.tx` em `permissionsCalculators.js` (Deadlock `SQLITE_BUSY`)

> **Status: PROPOSTO** em 2026-07-17
> **Escopo:** Garantir a passagem explícita de `{ transaction: ctx.tx }` para as consultas do Sequelize dentro de `collectProjectDescendants` em `backend/services/permissionsCalculators.js:16-36`.
> **Depende de:** -

## Diagnóstico
O método `collectProjectDescendants` (`permissionsCalculators.js:16`) é chamado por `calculateProjectPerms(ctx, action)` durante operações de compartilhamento executadas sob uma transação ativa `sequelize.transaction(async (tx) => ...)` (`execAction.js:23`). No entanto, as consultas `Task.findAll` e `Note.findAll` em `collectProjectDescendants` não recebem `{ transaction: ctx.tx }`.

### Impacto
Como `collectProjectDescendants` não passa a transação ativa, o Sequelize adquire uma nova conexão do pool de conexões para executar o `SELECT`. No SQLite (WAL/locking mode), quando a transação `tx` mantém locks de escrita na tabela de projetos ou tarefas, a conexão secundária é bloqueada, resultando no erro `SQLITE_BUSY` (deadlock da aplicação). Além disso, a conexão secundária lê um snapshot obsoleto que não enxerga mutações em andamento em `tx`.

## Implementação Proposta

1. Alterar a assinatura e chamadas de `collectProjectDescendants` em `permissionsCalculators.js:16` para aceitar `options = {}` ou `transaction`:
   ```javascript
   async function collectProjectDescendants(projectId, options = {}) {
       const { transaction } = options;
       const tasks = await Task.findAll({
           where: { project_id: projectId },
           attributes: ['id', 'uid'],
           transaction,
           raw: true
       });
       // ... aplicar transaction também em Note.findAll e buscas de subtarefas
   }
   ```
2. Em `calculateProjectPerms` (`permissionsCalculators.js:60+`), repassar `transaction: ctx.tx || ctx.transaction` para `collectProjectDescendants`.

## Critério de Pronto
- `npm run backend:test` limpo.
- Verificação de integração no teste de compartilhamento de projetos sob alta concorrência simulada.
