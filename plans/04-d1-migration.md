# Frente 4 — Migração da camada de dados para Cloudflare D1 via REST API

> **Status: EXECUTADO** em 2026-07-16 — commit `5e705e8` (feat(db): Cloudflare D1 data layer via REST API).
> Mantido como registro de decisão. Nota: a ativação do D1 em produção é um passo
> separado e pendente — ver `07-d1-activation.md`.

## 1. Inventário do estado atual

- **Models Sequelize**: 28 arquivos em `backend/models/` (user, area, project, task, tag, note, inbox_item, task_event, role, action, permission, view, api_token, setting, notification, recurringCompletion, task_attachment, backup, oidc_identity, oidc_state_nonce, auth_audit_log, caldav_* ×4, calendar_token, goal, person) + associações centralizadas em `backend/models/index.js:96-290`.
- **Consumo**: ~120 arquivos backend (fora testes) importam `sequelize`/models. Módulos com repository (`backend/modules/*/repository.js`) e vários com acesso direto a models nas rotas (ex.: `backend/modules/tasks/routes.js`).
- **Migrations**: ~60 arquivos em `backend/migrations/` executados via `sequelize-cli`/`umzug` (`npm run migration:run`), com `SequelizeMeta`.
- **Dependências de SQLite local**:
  - PRAGMAs de performance e WAL (`backend/models/index.js:22-63`).
  - `PRAGMA foreign_keys = OFF/ON` em `backend/modules/tasks/routes.js:959,975` e `backend/modules/projects/repository.js:258,347`.
  - Transações Sequelize (`sequelize.transaction`) em diversos fluxos (delete de projeto, admin cascade, etc.).
  - SQL cru pontual (`DELETE FROM tasks_tags ...` em `tasks/routes.js:967`).
  - Backups por cópia do arquivo `.sqlite3` (`backend/services/backupService.js`, docs/backups.md).
  - Frente 3 usa a tabela `settings` já existente — nenhuma tabela nova; nasce compatível.

## 2. Escolha da camada de acesso — decisão

**Drizzle descartado.** O driver D1 do Drizzle (`drizzle-orm/d1`) é para *binding nativo de Worker*; para REST haveria `sqlite-proxy`, que funciona, mas exigiria reescrever manualmente os 120 arquivos consumidores + 28 models + 60 migrations + toda a suíte de testes (48+ arquivos de integração que sobem o app inteiro sobre Sequelize). Custo/risco desproporcional e alta probabilidade de regressão silenciosa em queries com associações complexas (`findByUidWithIncludes` etc.).

**Escolhido: client HTTP fino e customizado sobre a REST API** (alternativa explicitamente prevista no enunciado), implementado como **driver compatível com a interface `sqlite3` consumido pelo Sequelize via `dialectModule`**:

- Sequelize v6 com `dialect: 'sqlite'` aceita `dialectModule` — qualquer módulo que exponha a superfície usada do `sqlite3` (`Database`, `run`, `all`, `exec`, `serialize`, `close`, constantes `OPEN_*`).
- O driver (`backend/db/d1RestDriver.js`) traduz cada statement SQL para `POST /accounts/{account_id}/d1/database/{database_id}/query` e devolve `rows`/`lastID`/`changes` a partir de `result[0].results` e `meta.last_row_id`/`meta.changes`.
- Ganhos: models, associations, migrations (`sequelize-cli` roda por cima da mesma conexão), módulos e testes permanecem intactos; a troca é 100% confinada a config + driver.
- O modo é ativado por env (`TUDUDI_DB_DRIVER=d1` + credenciais); sem env, comportamento atual (SQLite local) permanece — necessário para dev/test e para não quebrar o Docker existente.

## 3. Client REST — desenho

`backend/db/d1Client.js`:

- **Auth**: `Authorization: Bearer ${CLOUDFLARE_API_TOKEN}`; env: `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_D1_DATABASE_ID`, `CLOUDFLARE_API_TOKEN`.
- **Request**: `POST .../d1/database/{id}/query` com `{ sql, params }`; `fetch` nativo do Node 18+; timeout via `AbortController` (default 30 s, `D1_TIMEOUT_MS`).
- **Parsing**: valida `success`; erro → lança `D1Error` com `errors[].message/code`.
- **Rate limit (1200 req/5 min por conta)**: limitador local por janela deslizante (margem de segurança configurável, default 1100/5 min) — requisições aguardam slot; além disso, retry com backoff exponencial + jitter para HTTP 429/5xx (máx. 3 tentativas).
- **Fila serializada** por "conexão" lógica para preservar a ordem que o `serialize()` do sqlite3 garante.

## 4. Reescrita de schema

Nenhuma: D1 **é** SQLite. O schema criado pelas migrations atuais é aceito pelo D1. Tradução necessária só nos PRAGMAs (ver §9).

## 5. Migrations

Mantidas como estão: `npm run migration:run` com `TUDUDI_DB_DRIVER=d1` roda os mesmos arquivos contra o D1 através do driver (cada statement vira uma chamada REST; `SequelizeMeta` funciona normalmente). Sem sistema novo de migration.

## 6. Pontos de código a alterar

- `backend/models/index.js` — selecionar `dialectModule` pelo env; pular PRAGMAs locais (WAL/mmap) no modo D1.
- `backend/config/config.js` — bloco `d1` (accountId, databaseId, apiToken, enabled).
- Novos: `backend/db/d1Client.js`, `backend/db/d1RestDriver.js`.
- Tratamento de PRAGMA no driver (mapear/neutralizar — ver §9).
- `.env.example`/README: novas variáveis.
- Nenhum module/repository/rota muda.

## 7. Testes

- Suíte existente continua em SQLite local (NODE_ENV=test) — sem mudança, valida que o modo default não regrediu.
- Novos testes unitários do driver/client (`backend/tests/unit/d1*.test.js`) com HTTP mockado: mapeamento run/all/exec, lastID/changes, tratamento de erro da API, retry 429, neutralização de PRAGMA/BEGIN, ordem de execução do serialize.

## 8. Ordem de execução

1. `d1Client.js` (HTTP, auth, timeout, rate limit, erros) + testes.
2. `d1RestDriver.js` (interface sqlite3 → client) + testes.
3. Config/env + seleção em `models/index.js`.
4. Suíte completa + lint.

## 9. Riscos e pontos de atenção (explícitos)

- **Sem transação real**: a REST API é stateless; `BEGIN/COMMIT/ROLLBACK` emitidos pelo Sequelize não têm sessão para viver. O driver os neutraliza (no-op logado). Consequência: fluxos como `deleteWithOrphaning` perdem atomicidade no modo D1 — falha no meio deixa estado parcial (aceito e documentado; DB de produção vazio, decisão do enunciado).
- **PRAGMAs**: `foreign_keys OFF/ON` → mapeado para `PRAGMA defer_foreign_keys = true/false` (suportado pelo D1); PRAGMAs de performance local (WAL, mmap, cache_size, busy_timeout, synchronous) → no-op no driver.
- **Latência**: cada statement = 1 round-trip HTTP; endpoints com N+1 (ex.: loops de `attachment.destroy()`) ficam proporcionalmente mais lentos.
- **Rate limit global da conta**: 1200 req/5 min compartilhado com outros usos da API CF; o limitador local só protege este processo.
- **Backup**: `backupService` copia arquivo local — não se aplica ao D1 (usar export do próprio Cloudflare); documentado, sem mudança de código nesta frente.
- **`sqlite_master`/funções especiais**: Sequelize usa `PRAGMA TABLE_INFO`, `pragma foreign_key_list` etc. em describeTable/migrations — D1 suporta `PRAGMA table_info` e `foreign_key_list` via query; verificar em teste de driver.
