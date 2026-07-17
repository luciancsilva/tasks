# 09a — Remoção da camada de dados Cloudflare D1 (código)

> **Status: Aberto.** Prioridade: média. Esforço: médio.
> **Exige julgamento**: mexe em `config.js` e `models/index.js`; não é tarefa
> mecânica. A limpeza da documentação é o `09b`, e depende deste.
>
> Este plano substitui e consolida os antigos `04-d1-migration.md`
> (implantação), `07-d1-activation.md` (ativação) e `08-d1-rollback-sqlite.md`
> (rollback), apagados em `3bb1e213` — o §Registro abaixo preserva a história e
> a lição.

Pré-requisito de leitura: `plans/README.md` (regras) e `CLAUDE.md`.

## Registro: o que foi o D1 e por que sai

Linha do tempo, para que ninguém precise garimpar o git:

1. **Implantado** em 2026-07-16 (commit `5e705e8`): driver sqlite3-compatível
   (`backend/db/d1RestDriver.js`) traduzindo cada statement Sequelize para
   `POST /accounts/{id}/d1/database/{id}/query`. Drizzle foi descartado na época
   por exigir reescrever 120 arquivos consumidores.
2. **Ativado** em produção no mesmo dia: schema via `sync` + 94 migrations
   registradas, smoke funcional completo (login, projeto, tarefa, anexo no R2).
3. **Zerou o banco de produção duas vezes** (2026-07-16 22:43 e 2026-07-17
   00:35). O `backend/cmd/start.sh` decidia se o banco existia testando o
   **arquivo SQLite local**; em modo D1 esse arquivo nunca existe, então todo
   boot rodava `scripts/db-init.js` = `sequelize.sync({ force: true })` = DROP de
   todas as tabelas — contra o D1 remoto. Sobreviveu só o `SequelizeMeta`
   (95 linhas), porque `sync` não derruba tabela que não é model. Zero
   tasks/projects/areas/notes restaram.
4. **Revertido** em 2026-07-17 (commit `ef690f67`): SQLite local + volume,
   travas anti-wipe, mounts do compose corrigidos.
5. **Removido** por este plano.

**Motivo da remoção — é arquitetural, não bug.** Via REST API cada statement é um
round-trip HTTPS para `api.cloudflare.com`, sem transação e sem pool: ~150-250ms
por query desde o Brasil. Telas com joins/N+1 levavam 5-30s e abortavam. Somam-se
o rate limit de 1100 req/5min e a ausência de `BEGIN/COMMIT` reais. D1 via REST
serve a Worker (binding colocado, sub-ms), não a container Node. Batching
reduziria round-trips, não a latência de rede por request.

**A lição que deve sobreviver ao código:** nunca decidir *"o banco existe?"* por
artefato local — arquivo, volume, path — quando o banco é remoto. Nenhum deles
descreve um banco remoto. Foi essa confusão, e só ela, que destruiu os dados duas
vezes. Ao trocar o backend de dados, auditar **todo** caminho que faça essa
pergunta.

**Se um dia voltar**: a receita completa está no git (`5e705e8` para o driver,
`753b826` e `ef690f67` para ativação/rollback). Pré-requisito antes de tentar de
novo: resolver a latência (batch atômico numa única chamada REST), não repetir o
driver statement-a-statement.

## Itens

Inventário validado por grep em 2026-07-17: 23 arquivos citam D1.

### 09-1. Apagar os arquivos do driver

- `backend/db/d1Client.js`
- `backend/db/d1RestDriver.js`
- `backend/tests/unit/d1Client.test.js`
- `backend/tests/unit/d1RestDriver.test.js`
- `backend/tests/unit/d1SequelizeIntegration.test.js`

Depois disso `backend/db/` fica só com os arquivos `.sqlite3` locais.

### 09-2. Remover o wiring

- `backend/config/config.js` — bloco `d1` inteiro (getters `enabled`,
  `accountId`, `databaseId`, `apiToken`, `baseUrl`, `timeoutMs`; ~linhas
  178-215), incluindo o comentário de bloco acima dele.
- `backend/config/database.js` — `useD1` e `dialectModule` (linhas 11-19); o
  config volta a ser sqlite puro.
- `backend/models/index.js` — `useD1` (linha 9), o ternário de `storage`
  (linha 15), o `dialectModule` (linha 16) e a condição `&& !useD1` das PRAGMAs
  locais (linha 30). As PRAGMAs de performance passam a valer sempre; ajustar o
  comentário que hoje diz "Local-file only: these PRAGMAs are meaningless on D1".
- `backend/cmd/start.sh` — o ramo `if [ "${TUDUDI_DB_DRIVER:-}" = "d1" ]`
  (criado pelo plano 08); volta ao `if [ ! -f "$DB_FILE" ]` / `else backup_db`
  simples. **Não mexer** no mount nem no `backup_db` — não são D1.
- `backend/scripts/db-init.js` — `isD1InitBlocked`, a chamada dentro de
  `initDatabase()` e o require de `getConfig`. **Manter** o
  `if (require.main === module)` e o `module.exports`: é o que impede o script de
  rodar o `sync({force:true})` ao ser importado.
- `backend/tests/unit/db-init-guard.test.js` — os casos da trava somem com ela.
  Preservar (renomeando o arquivo se fizer sentido) o teste de que **importar o
  módulo não dispara o init** — essa proteção continua valendo.

### 09-3. Env vars — duas são compartilhadas, atenção

| Var | Ação | Por quê |
|---|---|---|
| `TUDUDI_DB_DRIVER` | Remover | Existia só para ligar o D1 |
| `CLOUDFLARE_D1_DATABASE_ID` | Remover | Idem |
| `CLOUDFLARE_API_TOKEN` | Tirar do `docker-compose.yml`; **manter no `.env`** | Em runtime só o `d1Client.js:53` usava. O `wrangler` CLI precisa dele — marcar em `.env.example` como opcional (uso de CLI, não da app) |
| **`CLOUDFLARE_ACCOUNT_ID`** | **MANTER em tudo** | **O R2 depende dela** para montar o endpoint (getter `r2.endpoint` em `backend/config/config.js`; `docs/15-storage.md:12`). Remover quebra upload de anexo, avatar, capa e branding |

Arquivos: `docker-compose.yml` (bloco `environment`, linhas 20-32), `.env.example`
(linha 70 e o bloco D1; a linha 23 do `CLOUDFLARE_ACCOUNT_ID` fica), `.env` local
(não versionado — avisar o dono, não commitar).

### 09a-4. Fora deste plano

- **Documentação** (`CLAUDE.md`, `README.md`): é o `09b-d1-docs-cleanup.md`.
- **Limpeza do `/plans`**: já feita em `3bb1e213` (apagados 04/07/08, removido o
  HE-3 do `05c`, tiradas as menções de `05`, `05b` e `06`).

## Verificação

1. **Baseline** (regra 2): `npm run backend:test` antes de mudar — hoje 113
   suites / 1665 testes.
2. Depois: a contagem **cai** (3 suítes de D1 + os casos da trava). Conferir que
   a queda é exatamente essa e que nada mais quebrou.
3. `grep -rniE "d1|TUDUDI_DB_DRIVER" --include=*.js .` ignorando `node_modules/`
   não retorna nada. (Docs ainda citam D1 até o `09b` rodar — é esperado.)
4. **Smoke — o risco real é o R2, não o banco**: subir o app, login, criar
   tarefa e **anexar um arquivo**; baixar o anexo. Isso prova que o
   `CLOUDFLARE_ACCOUNT_ID` compartilhado sobreviveu à remoção. Depois
   `docker compose up -d --force-recreate` e confirmar que os dados persistem
   (não pode aparecer `first-time installation`).
5. Lint só nos arquivos tocados (lint global tem ruído CRLF pré-existente).
6. Commit único: `refactor(db): remove the Cloudflare D1 data layer`, corpo
   citando `plans/09a`.
