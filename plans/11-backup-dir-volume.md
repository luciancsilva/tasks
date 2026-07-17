# 11 — Backup lógico grava em diretório efêmero

> **Status: EXECUTADO** em 2026-07-17 — `TUDUDI_BACKUP_PATH` adicionado ao config, `getBackupsDirectory()` usa a config, var declarada no Dockerfile/`.env.example`/`docker-compose.yml`; testes unitários cobrindo o comportamento.

Pré-requisito de leitura: `plans/README.md`.

## Contexto

Descoberto em 2026-07-17 ao investigar backup (regra 3: descoberta vira item, não
scope creep). Não confundir com `plans/10-db-backup-r2.md`, que é disaster
recovery offsite; este item é sobre a feature de backup **lógico** que já existe
no upstream.

`backend/services/backupService.js` (905 linhas) e `backend/modules/backup/` já
implementam export/import por usuário: `exportUserData`, `saveBackup` com gzip,
retenção dos últimos 5, `listBackups`, `downloadBackup`, `importUserData` com
merge e checagem de versão, tudo com rotas HTTP.

**O problema**: `getBackupsDirectory()` resolve para
`path.join(__dirname, '../backups')` = `/app/backend/backups` no container. O
`Dockerfile:113-114` só declara `VOLUME` para `/app/db` e `/app/uploads`. Logo, o
diretório de backups é **efêmero**: morre a cada recriação de container — junto
com aquilo que deveria proteger.

A feature vem desligada (`FF_ENABLE_BACKUPS=false`, `Dockerfile:130`), então
ninguém foi mordido ainda. Ligar hoje daria falsa sensação de segurança, que é o
pior estado possível para um backup.

## Item

1. Tornar o diretório configurável: `TUDUDI_BACKUP_PATH`, com default apontando
   para dentro de um caminho persistente (`/app/db/backups` reaproveita o volume
   `tududi_db` que já existe; volume próprio também serve). Ler via
   `backend/config/config.js`, seguindo o padrão dos demais getters (ex.:
   `uploadPath`, `config.js:104`).
2. `getBackupsDirectory()` passa a usar a config em vez do `__dirname`.
3. Declarar a env var no `Dockerfile`, `.env.example` e `docker-compose.yml`.
4. Se o default mudar de lugar, tratar backups pré-existentes: como a feature
   nunca foi ligada em produção, basta criar o diretório novo — não há migração
   de dados a fazer. Confirmar antes de assumir.

## Testes

Regra 4 do `/plans`. `getBackupsDirectory()` respeita `TUDUDI_BACKUP_PATH`;
default cai no caminho persistente; o diretório é criado se não existir
(comportamento atual, não regredir).

## Verificação

- Baseline `npm run backend:test` antes; suíte verde depois.
- Smoke: `FF_ENABLE_BACKUPS=true`, criar backup pela rota, `docker compose up -d
  --force-recreate`, confirmar que o backup **continua listado** e baixável.
  Esse é o teste que prova o item — o resto é detalhe.
- Commit: `fix(backup): store logical backups on a persistent volume`, corpo
  citando `plans/11`.
