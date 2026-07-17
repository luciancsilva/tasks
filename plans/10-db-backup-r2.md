# 10 — Backup do banco: snapshot periódico do SQLite no R2

> **Status: Aberto.**

Pré-requisito de leitura: `plans/README.md` (regras) e `CLAUDE.md`.

## Contexto

Em 2026-07-16/17 o banco de produção foi zerado duas vezes por um bug de boot
(`plans/09-d1-removal.md` §Registro). O incidente expôs o problema de fundo:
**não existe backup nenhum**. O que existe hoje:

- `backup_db()` em `backend/cmd/start.sh` — cópia do arquivo SQLite antes das
  migrations, retenção de 4/dia + 1/dia por 7 dias. Fica **na mesma máquina**:
  não protege contra perda do host/volume, que é exatamente o cenário do
  incidente.
- `backend/modules/backup/` + `backend/services/backupService.js` — export/import
  lógico por usuário. Desligado, não agendado, e grava em diretório efêmero
  (`plans/11-backup-dir-volume.md`). Não serve como disaster recovery: é por
  usuário e não cobre `users`, `settings` nem branding.

**Objetivo declarado pelo dono (2026-07-17): não perder dados se o container
morrer.** Disaster recovery, não réplica consultável nem point-in-time fino.

**Decisão: snapshot periódico do arquivo `.sqlite3` para o R2.** O R2 já está
configurado e funcionando (anexos, avatares, capas, branding).

### Alternativa descartada: replicar cada escrita para o Cloudflare D1

Foi a proposta original. Descartada na discussão de 2026-07-17:

- **Devolve a latência** que motivou a remoção do D1: replicação síncrona põe um
  round-trip de ~200ms em cada escrita. Assíncrona não paga latência, mas não
  garante entrega.
- **Sem transação**: o driver REST neutralizava `BEGIN/COMMIT`. Fluxos
  multi-statement (delete de tarefa com subtasks/tags/eventos) replicariam
  estados parciais que nunca existiram no original.
- **Rate limit**: 1100 req/5min. Delete de projeto grande dispara centenas de
  requests; o limiter dorme e o app trava.
- **Dual-write diverge em silêncio**: sem outbox/log não há reconciliação. Backup
  que diverge sem avisar é pior que backup nenhum — a descoberta acontece no
  restore.
- **Custo/benefício**: snapshot no R2 = 1 request, artefato íntegro e datado,
  restore por cópia de arquivo. Replicação = milhares de requests para produzir
  algo não-confiável.

Um banco é o destino errado para backup: paga-se semântica de banco
(round-trip por statement, rate limit) para uma necessidade de object storage
(um blob íntegro e datado).

## Itens

### 10-1. Completar a API do `r2Service`

`backend/services/r2Service.js` importa hoje só `GetObjectCommand`,
`DeleteObjectCommand` e `HeadObjectCommand` (linhas 16-21) e expõe `getClient`,
`getBucket`, `getUploadStorage`, `deleteObject`, `getObjectStream`,
`objectExists`. **Não há como subir um arquivo do disco** — `getUploadStorage` é
engine multer-s3, serve só para upload via HTTP. Adicionar:

- `putObjectFromFile(key, filePath, contentType)` — `PutObjectCommand` com
  `fs.createReadStream(filePath)` e `ContentLength` vindo de `fs.stat`. Stream +
  ContentLength evita carregar o banco inteiro em memória.
- `listObjects(prefix)` — `ListObjectsV2Command`, tratando paginação
  (`IsTruncated` / `ContinuationToken`). Necessário para a retenção.

Seguir o estilo do módulo: cliente via `getClient()`, bucket via `getBucket()`,
erros via `logError`, keys sempre sem barra inicial.

### 10-2. `backend/services/dbBackupService.js` (novo)

`createSnapshot()`:

1. Abortar (log + return) se `!getConfig().r2.enabled` — getter já existe em
   `backend/config/config.js` (`r2.enabled` = todas as credenciais presentes).
2. Gerar snapshot consistente: `VACUUM INTO '<tmp>'` via `sequelize.query`.
   Funciona com o WAL ligado (`backend/models/index.js:64`) e **não para a
   aplicação**. Dois cuidados: o arquivo destino **não pode existir** (VACUUM
   INTO falha se já estiver lá) e o path é gerado pelo serviço, nunca entrada de
   usuário.
3. Subir com `putObjectFromFile` para
   `db-backups/production-YYYYMMDDTHHMMSS.sqlite3`.
4. Apagar o temporário em `finally` — **inclusive quando o upload falha**, senão
   o disco enche em silêncio.
5. Retenção: `listObjects('db-backups/')`, ordenar por key (o timestamp no nome
   ordena lexicograficamente) e `deleteObject` no que exceder
   `TUDUDI_DB_BACKUP_RETENTION`.

### 10-3. Agendamento

Seguir o molde de `backend/modules/caldav/services/sync-scheduler.js`: classe com
`initialize()`, guarda `isInitialized`, `cron.schedule` (node-cron já é
dependência), log via `backend/services/logService`. Registrar em
`backend/app.js` junto dos outros schedulers (linhas 450-455, onde
`taskScheduler.initialize()` e `caldavSyncScheduler.initialize()` são chamados).

**Configuração por env var, não preferência de usuário.** Backup é infra de
instância, igual a `CALDAV_ENABLED` e `FF_ENABLE_BACKUPS`; não é coluna do
model `User`. Toggle de UI, se um dia fizer sentido, é item separado.

| Var | Default | O quê |
|---|---|---|
| `TUDUDI_DB_BACKUP_ENABLED` | `false` | Liga o job |
| `TUDUDI_DB_BACKUP_CRON` | `0 3 * * *` | Diário às 03:00 |
| `TUDUDI_DB_BACKUP_RETENTION` | `7` | Snapshots mantidos no R2 |

Declarar no `Dockerfile` (junto de `FF_ENABLE_BACKUPS=false`, linha 130), no
`.env.example` e no bloco `environment` do `docker-compose.yml`.

### 10-4. Testes

Regra 4 do `/plans`; mock de R2 com `aws-sdk-client-mock`, padrão de
`backend/tests/integration/task-attachments.test.js`.

`dbBackupService`:
- aborta quando o R2 está desabilitado;
- gera o snapshot e chama `PutObjectCommand` com a key esperada;
- apaga o temporário mesmo quando o upload falha;
- retenção deleta só o excedente e preserva os N mais recentes.

`r2Service`:
- `putObjectFromFile` monta o comando com Bucket/Key/ContentLength corretos;
- `listObjects` percorre a paginação (mais de uma página).

Scheduler: não agenda quando `TUDUDI_DB_BACKUP_ENABLED` é falso; agenda com o
cron configurado.

### 10-5. Documentar o restore

`docs/backups.md` ganha a seção do snapshot no R2: onde vive (`db-backups/`),
cadência, retenção e **o procedimento de restore passo a passo**.

## Verificação

1. **Baseline** (regra 2): `npm run backend:test` antes de mudar.
2. Suíte completa verde + lint só nos arquivos tocados.
3. **Smoke real contra o R2**:
   ```bash
   cd backend && npx cross-env NODE_ENV=production TUDUDI_DB_BACKUP_ENABLED=true \
     node -e "require('./services/dbBackupService').createSnapshot().then(console.log)"
   ```
   Conferir o objeto no bucket (`npx wrangler r2 object get` ou painel) e que o
   temporário **não** ficou para trás.
4. **Restore de verdade — backup não testado não é backup.** Baixar o snapshot,
   subir um container com o volume apontando para ele, confirmar login e dados
   intactos. Só depois disso o plano pode ser marcado EXECUTADO.
5. Retenção: rodar `createSnapshot()` 3 vezes com
   `TUDUDI_DB_BACKUP_RETENTION=2` e confirmar que sobram 2 objetos, os mais
   recentes.
6. Commit: `feat(backup): snapshot the SQLite database to R2 on a schedule`,
   corpo citando `plans/10`.

## Fora de escopo

- Toggle de UI / endpoint "fazer backup agora".
- Consertar o backup lógico existente (`FF_ENABLE_BACKUPS` + diretório efêmero) —
  `plans/11-backup-dir-volume.md`.
- Backup dos objetos do R2 (anexos, avatares): já vivem no R2, que é o destino.
  Versionamento/cross-region do bucket é outra conversa.
- Point-in-time fino e réplica consultável: fora do objetivo declarado.
