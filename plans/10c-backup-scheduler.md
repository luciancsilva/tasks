# 10c — Agendar o snapshot do banco

> **Status: Aberto.** Prioridade: alta. Esforço: baixo.
> **Tarefa mecânica**: copiar um padrão que já existe no repo.
> **Depende de**: `10b-db-snapshot-service.md` (chama `createSnapshot()`).

Pré-requisito de leitura: `plans/README.md` e
`backend/modules/caldav/services/sync-scheduler.js` (é o molde).

## Contexto

O `10b` cria `createSnapshot()`, mas nada o chama. Este plano agenda.

## Itens

### 1. Scheduler

Novo arquivo seguindo **exatamente** o molde de
`backend/modules/caldav/services/sync-scheduler.js`:

- classe com `initialize()`;
- guarda `isInitialized` para não agendar duas vezes;
- checa a env var de liga/desliga logo no início e retorna com log se desligada
  (ver linhas 20-24 do molde);
- `cron.schedule(...)` do `node-cron` (já é dependência);
- logs via `backend/services/logService` (`logInfo`/`logError`), **não**
  `console.log`;
- o job deve **capturar erro e logar**, nunca deixar exceção subir do cron —
  senão uma falha de rede derruba o processo às 3 da manhã.

### 2. Registrar no boot

`backend/app.js`, junto dos outros schedulers (procure
`taskScheduler.initialize()` e `caldavSyncScheduler.initialize()`, ~linhas
450-455). Mesmo estilo.

### 3. Env vars

| Var | Default | O quê |
|---|---|---|
| `TUDUDI_DB_BACKUP_ENABLED` | `false` | Liga o job |
| `TUDUDI_DB_BACKUP_CRON` | `0 3 * * *` | Quando (diário às 03:00) |
| `TUDUDI_DB_BACKUP_RETENTION` | `7` | Snapshots mantidos no R2 (lido pelo `10b`) |

Declarar em:
- `Dockerfile` — junto de `FF_ENABLE_BACKUPS=false` (~linha 130);
- `.env.example` — com comentário curto explicando;
- `docker-compose.yml` — no bloco `environment`, no padrão `VAR: ${VAR:-}`.

**Configuração é env var, não preferência de usuário** — decisão de 2026-07-17.
Backup é infra de instância, igual a `CALDAV_ENABLED` e `FF_ENABLE_BACKUPS`; não
é coluna do model `User`. Não inventar toggle de UI aqui.

## Testes

Regra 4 do `/plans`.

- não agenda quando `TUDUDI_DB_BACKUP_ENABLED` é falso/ausente;
- agenda quando ligada, usando o cron configurado;
- `initialize()` duas vezes não agenda dois jobs;
- erro dentro do job é logado e **não** propaga.

## Verificação

- Baseline `npm run backend:test` antes; suíte verde depois.
- Subir o app com `TUDUDI_DB_BACKUP_ENABLED=false` (default): o log **não** deve
  mencionar o scheduler de backup como ativo.
- Subir com `TUDUDI_DB_BACKUP_ENABLED=true` e um cron curto (ex.: `* * * * *`)
  e confirmar no log que rodou e subiu o objeto. **Desfazer o cron curto depois.**
- Lint só nos arquivos tocados.
- Commit: `feat(backup): schedule the database snapshot`, corpo citando
  `plans/10c`.
