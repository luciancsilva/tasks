# 08 — Rollback do D1 para SQLite local + travas anti-wipe

> **Status: EXECUTADO** em 2026-07-17 — travas no `db-init.js` e no
> `start.sh`, mounts do compose corrigidos, D1 desligado no `.env`. Suíte:
> 113 suites / 1665 testes verdes. **Pendente**: smoke de persistência no
> container (item "Verificação"), que só roda depois do merge em `main` — o
> `docker-compose.yml` builda de `github.com/luciancsilva/tasks.git#main`.

Pré-requisito de leitura: `plans/README.md` (regras) e `plans/07-d1-activation.md`
(a ativação que este plano reverte).

## Contexto

Em 2026-07-16/17 o container recriou o banco do zero duas vezes (boots de 22:43
e 00:35), cada uma apagando os dados do **D1 remoto de produção**. Não foi
acidente de operação: era o comportamento programado do boot.

### Causa raiz — três bugs empilhados

1. `backend/cmd/start.sh` decidia se o banco existia testando **arquivo SQLite**
   (`if [ ! -f "$DB_FILE" ]`). Em modo D1 esse arquivo nunca existe, então todo
   boot caía no ramo "banco novo".
2. Esse ramo roda `scripts/db-init.js` = `sequelize.sync({ force: true })` =
   DROP + CREATE de todas as tabelas. Com `TUDUDI_DB_DRIVER=d1`, contra o D1
   remoto.
3. `docker-compose.yml` montava os volumes em caminhos legados
   (`/app/backend/db`, `/app/backend/uploads`). Os reais estão no `Dockerfile`:
   `VOLUME ["/app/db"]`, `VOLUME ["/app/uploads"]`,
   `DB_FILE=/app/db/production.sqlite3`, `TUDUDI_UPLOAD_PATH=/app/uploads`. Sem
   mount explícito, `/app/db` pegava um volume **anônimo**, descartado a cada
   recriação de container — o que disparava (1) mesmo sem D1.

### Evidências

- Boot 22:43 rodou **uma** migration (`20260716000000-rename-locales`); boot
  00:35: `No migrations were executed, database schema was already up to date`.
  Banco novo de verdade rodaria as 94 — logo o estado persistente era remoto.
- `sync({force:true})` levou 50-60s no boot (SQLite local: <1s) — 1 round-trip
  HTTP por statement.
- `wrangler d1 export` pós-incidente: `SequelizeMeta` 95 linhas, `Sessions` 10,
  `tags` 2, `users` 1, `roles` 1. **Zero** tasks/projects/areas/notes.
  `SequelizeMeta` sobreviveu porque `sync({force:true})` só derruba os models
  definidos.

### Decisão (2026-07-17, dono do repo)

Voltar para SQLite local + volume persistente. Produção é o container local;
Northflank é experimento. Motivo: a latência do D1 via REST é inerente à
arquitetura — cada statement é um round-trip HTTPS para `api.cloudflare.com`
(`backend/db/d1Client.js`), sem transação e sem pool, ~150-250ms por query desde
o Brasil. Telas com joins/N+1 levavam 5-30s e abortavam. Batching (`05c` HE-3)
reduziria round-trips, não a latência de rede por request.

As travas anti-wipe **ficam no código** mesmo com o D1 desligado: sem elas,
religar o driver no futuro repete o acidente.

## Itens

### 08-1 — Corrigir os mounts do `docker-compose.yml`

`tududi_db:/app/db` e `tududi_uploads:/app/uploads`. Os volumes nomeados antigos
estavam vazios (nada nunca escreveu nos caminhos legados): sem dado a migrar.

### 08-2 — Desligar o D1 no `.env`

`TUDUDI_DB_DRIVER=` (vazio). Demais `CLOUDFLARE_*` intactas — o R2 segue ligado
e é independente do driver de banco (`backend/config/config.js` isola o D1 atrás
de `TUDUDI_DB_DRIVER === 'd1'`). Export final guardado fora do repo antes de
desligar.

### 08-3 — Trava no `scripts/db-init.js`

`isD1InitBlocked(d1Enabled, allowFlag)` recusa o `sync({force:true})` quando o
driver D1 está ativo, salvo `TUDUDI_ALLOW_D1_INIT=1` explícito (escotilha para o
bootstrap legítimo de um D1 vazio — `plans/07-d1-activation.md` lição 1).
Protege também a invocação manual (`npm run db:init`). O auto-run virou
`require.main === module` para o módulo ficar testável.

### 08-4 — Trava no `backend/cmd/start.sh`

Ramo dedicado para `TUDUDI_DB_DRIVER=d1`: valida o banco remoto com
`scripts/db-status.js` e sai com erro pedindo bootstrap manual se falhar —
**nunca** cai em `db-init.js`. `backup_db()` (cópia de arquivo) é pulado, sem
sentido em D1.

### 08-5 — Testes

`backend/tests/unit/db-init-guard.test.js`: unitários da função pura + execução
real do script via `spawnSync` com `NODE_ENV=production TUDUDI_DB_DRIVER=d1`
(necessário porque `config.d1.enabled` é hard-off em `NODE_ENV=test`) e
credenciais Cloudflare **falsas** — se a trava regredir, o teste não alcança o
D1 real.

## Se um dia religar o D1

1. `TUDUDI_DB_DRIVER=d1` + as três credenciais no `.env`.
2. D1 vazio: `TUDUDI_ALLOW_D1_INIT=1 node scripts/db-init.js`, depois
   `npx sequelize-cli db:migrate` (`plans/07-d1-activation.md` passos 5-6).
3. Nunca deixar `TUDUDI_ALLOW_D1_INIT=1` fixo no ambiente do container — é
   escotilha de bootstrap manual, não configuração.
4. Antes, resolver a latência: `plans/05c-high-effort.md` HE-3 (batch atômico)
   e a caça a N+1. Sem isso o app é inutilizável na prática.

## Verificação

- `npm run backend:test` verde (baseline: 112 suites / 1660 testes).
- `TUDUDI_DB_DRIVER=d1 node scripts/db-init.js` aborta sem tocar na rede.
- Smoke de persistência: `docker compose up -d --build`, criar área + tarefa,
  `docker compose down && docker compose up -d --force-recreate`. Critério: log
  mostra `Database backed up to ...` e **não** `first-time installation` nem
  `WARNING: This will drop all existing data!`; os dados continuam lá.
