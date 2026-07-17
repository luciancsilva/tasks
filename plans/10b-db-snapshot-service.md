# 10b — Serviço de snapshot do banco para o R2

> **Status: Aberto.** Prioridade: alta. Esforço: médio.
> **Exige julgamento**: consistência de snapshot com WAL, limpeza de temporário
> no caminho de erro.
> **Depende de**: `10a-r2-put-and-list.md` (usa `putObjectFromFile` e
> `listObjects`). **Destrava**: `10c-backup-scheduler.md`.

Pré-requisito de leitura: `plans/README.md`.

## Contexto

O banco de produção foi zerado duas vezes em 2026-07-16/17 por um bug de boot
(ver `plans/09a-d1-code-removal.md` §Registro). O incidente expôs o problema de
fundo: **não existe backup offsite**.

O que existe hoje e **não** resolve:

- `backup_db()` em `backend/cmd/start.sh` — cópia do arquivo SQLite antes das
  migrations, retenção de 4/dia + 1/dia por 7 dias. Fica **na mesma máquina**:
  não protege contra perda do host/volume, que é exatamente o cenário do
  incidente.
- `backend/modules/backup/` + `backend/services/backupService.js` — export/import
  lógico por usuário. Desligado, não agendado, e grava em diretório efêmero
  (`plans/11-backup-dir-volume.md`). Não serve como disaster recovery: é por
  usuário e não cobre `users`, `settings` nem branding.

**Objetivo declarado pelo dono (2026-07-17)**: não perder dados se o container
morrer. Disaster recovery, não réplica consultável nem point-in-time fino.

### Alternativa descartada: replicar cada escrita para o Cloudflare D1

Foi a proposta original, rejeitada na discussão de 2026-07-17. Registrado aqui
para não ser reproposta:

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

Um banco é o destino errado para backup: paga-se semântica de banco (round-trip
por statement, rate limit) para uma necessidade de object storage (um blob
íntegro e datado). Snapshot no R2 = 1 request, artefato restaurável por cópia.

## Item: `backend/services/dbBackupService.js` (novo)

`createSnapshot()`:

1. **Abortar** (log + return, sem lançar) se `!getConfig().r2.enabled`. O getter
   já existe em `backend/config/config.js` (`r2.enabled` = todas as credenciais
   presentes). Sem destino não há backup — e um job agendado não deve derrubar o
   processo.
2. **Snapshot consistente**: `VACUUM INTO '<tmp>'` via `sequelize.query`.
   Funciona com o WAL ligado (`backend/models/index.js:64`) e **não para a
   aplicação** — é por isso que se usa isso em vez de copiar o arquivo, que com
   WAL pode capturar estado parcial. Dois cuidados:
   - o arquivo destino **não pode existir** (VACUUM INTO falha se já estiver lá);
   - o path é gerado pelo serviço, **nunca** entrada de usuário.
3. **Subir**: `putObjectFromFile` (do `10a`) para
   `db-backups/production-YYYYMMDDTHHMMSS.sqlite3`. O timestamp no nome faz a
   ordenação lexicográfica coincidir com a cronológica — a retenção depende disso.
4. **Apagar o temporário em `finally`** — inclusive quando o upload falha. Sem
   isso o disco enche em silêncio, e o disco é o mesmo do banco.
5. **Retenção**: `listObjects('db-backups/')` (do `10a`), ordenar por key e
   `deleteObject` no que exceder `TUDUDI_DB_BACKUP_RETENTION` (default `7`; ler
   via config, seguindo o padrão dos getters existentes).

Retornar algo útil para log/teste (key criada, tamanho, quantos foram podados).

## Testes

Regra 4 do `/plans`. Mock de R2 com `aws-sdk-client-mock` (padrão de
`backend/tests/integration/task-attachments.test.js`).

- aborta quando o R2 está desabilitado (e **não** lança);
- gera o snapshot e chama `PutObjectCommand` com a key no formato esperado;
- **apaga o temporário mesmo quando o upload falha** — teste do caminho de erro,
  é o que mais quebra na prática;
- retenção deleta só o excedente e preserva os N mais recentes;
- retenção não apaga nada quando há menos que N.

## Verificação

1. Baseline `npm run backend:test` antes; suíte verde depois.
2. **Smoke real contra o R2** (só se as credenciais estiverem no `.env`):
   ```bash
   cd backend && npx cross-env NODE_ENV=production \
     node -e "require('./services/dbBackupService').createSnapshot().then(console.log)"
   ```
   Conferir o objeto no bucket (painel ou `npx wrangler r2 object get`) e que o
   temporário **não** ficou para trás.
3. **Sanidade do artefato**: baixar o snapshot e abrir com
   `sqlite3 <arquivo> ".tables"`; as tabelas e os dados têm que estar lá. O
   restore completo em container é o `10d`.
4. Lint só nos arquivos tocados.
5. Commit: `feat(backup): snapshot the SQLite database to R2`, corpo citando
   `plans/10b`.

## Fora deste plano

- Agendamento e env vars de liga/desliga: `10c-backup-scheduler.md`.
- Documentar o restore: `10d-backup-restore-docs.md`.
- Backup dos objetos do R2 (anexos, avatares): já vivem no R2, que é o destino.
- Consertar o backup lógico existente: `11-backup-dir-volume.md`.
