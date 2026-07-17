# 19g — Teto Máximo na Paginação via `limit` (Prevenção de Out-Of-Memory DOS)

> **Status: EXECUTADO** em 2026-07-17 — teto MAX_LIMIT=100 aplicado à paginação de notifications, tasks/events e inbox, prevenindo exaustão de memória por limit gigante.
> **Escopo:** Padronizar um teto máximo seguro (`MAX_LIMIT = 100`) para todas as consultas paginadas que aceitam `req.query.limit` em `notifications`, `inbox` e `tasks/events`.
> **Depende de:** -

## Diagnóstico
As rotas e repositórios recebem `limit` sem restrição superior de tamanho:
1. `backend/models/notification.js:357` (`getUserNotifications`): usa `limit = parseInt(options.limit) || 10` sem teto.
2. `backend/modules/tasks/events.js:170`: faz `parseInt(limit)` e passa direto para a query do Sequelize.
3. `backend/modules/inbox/service.js:47`: se omitido, executa `inboxRepository.findAllActive` sem paginação ou limite.

### Impacto
Um usuário ou atacante enviando `GET /api/notifications?limit=500000` força o Node.js e o Sequelize a alocar meio milhão de instâncias de modelo em memória RAM simultaneamente, causando exaustão de memória (`FATAL ERROR: Ineffective mark-compacts near heap limit Allocation failed - JavaScript heap out of memory`) e derrubando o servidor.

## Implementação Proposta

1. Criar constante utilitária ou aplicar em cada serviço: `const MAX_LIMIT = 100;`
2. Em `notification.js:357`:
   ```javascript
   const parsedLimit = parseInt(options.limit, 10);
   const limit = !isNaN(parsedLimit) && parsedLimit > 0 ? Math.min(parsedLimit, 100) : 10;
   ```
3. Em `tasks/events.js:170`:
   ```javascript
   const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100);
   ```
4. Em `inbox/service.js:47`, definir `limit` default (ex: 50) e teto máximo de 100 quando os parâmetros forem fornecidos ou na query sem paginação explicita.

## Critério de Pronto
- `npm run backend:test` limpo.
- Adicionar teste de integração em `tests/integration/notifications.test.js` ou `events.test.js` passando `?limit=999999` e validando que o payload retornado ou a query executada respeita o limite de 100 registros.
