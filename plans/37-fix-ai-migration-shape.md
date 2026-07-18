# 37 — migration do plano 32 quebrada (shape errado do safeAddColumns)

> **Status: EXECUTADO** em 2026-07-18 — `20260718000000-add-ai-config-to-users` passava as defs de coluna com `type/allowNull/defaultValue` no topo, mas `safeAddColumns` chama `addColumn(table, column.name, column.definition)` e espera `{ name, definition: {...} }`. `column.definition` vinha `undefined` → `addColumn takes at least 3 arguments`, migration nunca aplicava. Corrigido envolvendo cada def em `definition:`; aplicada limpa no dev DB (0 pending).
> **Esforço:** Baixo · **Natureza:** correção (bug de deploy) · **Modelo:** médio.
> **Branch:** `main` · **Depende de:** 32.

## Diagnóstico

Achado ao popular o dev DB + smoke-test MCP: toda requisição autenticada dava
500 `SQLITE_ERROR: no such column: ai_api_key`, porque a migration aditiva do
plano 32 nunca tinha aplicado. Ao rodar `db:migrate` no dev DB, o erro real:
`addColumn takes at least 3 arguments`.

Raiz: `backend/utils/migration-utils.js` `safeAddColumns(queryInterface,
tableName, columns)` itera e chama
`queryInterface.addColumn(tableName, column.name, column.definition)` — cada
coluna precisa ser `{ name, definition: {...} }` (ver referência
`migrations/20250615000002-add-first-day-of-week-to-users.js`). A migration do
plano 32 usava `{ name, type, allowNull, defaultValue }` (sem `definition`).

## Por que os testes não pegaram (lição plano 12)

`NODE_ENV=test` constrói o schema via `sequelize.sync()` a partir dos **models**
(que têm as colunas), então **as migrations nunca são exercidas** na suíte — o
mesmo ponto cego do plano 12. Backend 127/1709 verde mesmo com a migration
quebrada. **Follow-up recomendado:** um teste que rode `db:migrate` num DB limpo
e falhe se alguma migration lançar (fecharia essa classe de bug de deploy).
Registrado como candidato; ver plano 38 para a fragilidade de auth relacionada.

## Fix aplicado

Cada coluna de `ai_provider/ai_api_key/ai_model/ai_base_url` passou a
`{ name, definition: { type, allowNull, defaultValue } }`. Verificado: aplica no
dev DB, colunas criadas, `db:migrate:status` sem pendências.

## Critério de Pronto (atingido)

- Migration aplica limpa (dev DB), 0 pending.
- Backend suite verde.
