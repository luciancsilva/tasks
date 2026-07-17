# 10d — Documentar e testar o restore do snapshot

> **Status: Aberto.** Prioridade: alta. Esforço: baixo.
> **Depende de**: `10b` e `10c` (precisa existir snapshot real no R2 para
> restaurar).
>
> **Este plano é o que dá valor aos anteriores.** Backup não testado não é
> backup — é esperança. Sem o `10d`, o `10b`/`10c` são só código que sobe
> arquivo.

Pré-requisito de leitura: `plans/README.md` e `docs/backups.md` (o doc atual).

## Itens

### 1. Executar um restore de verdade

Antes de escrever o doc, **fazer**, e escrever o que realmente funcionou:

1. Garantir que existe um snapshot no R2 (`db-backups/`) com dados reais.
2. Baixar o objeto (painel do Cloudflare ou `npx wrangler r2 object get`).
3. Parar o container.
4. Pôr o arquivo no volume, no caminho que o app espera:
   `/app/db/production.sqlite3` (definido no `Dockerfile`; o volume é
   `tududi_db`).
5. Subir e confirmar: login funciona, tarefas/projetos/áreas estão lá.

Anotar as pegadinhas encontradas — permissão do arquivo (o entrypoint faz
`chmod 660`), dono (`app:app`), e os arquivos `-wal`/`-shm` que podem estar no
volume e precisam sair junto para não conflitar com o banco restaurado.

### 2. Escrever a seção em `docs/backups.md`

Acrescentar seção do snapshot no R2 com:
- o que é e o que **não** é (banco sim; anexos não — esses já vivem no R2);
- onde vive: prefixo `db-backups/`, formato do nome, cadência, retenção;
- as env vars (`TUDUDI_DB_BACKUP_ENABLED`, `_CRON`, `_RETENTION`);
- **o procedimento de restore passo a passo**, exatamente como executado no
  item 1, incluindo as pegadinhas;
- como verificar um snapshot sem restaurar: `sqlite3 <arquivo> ".tables"`.

Manter o estilo do doc existente. Não reescrever o que já está lá sobre o backup
de arquivo local do `start.sh` — os dois coexistem e servem a coisas diferentes
(local = rollback rápido de migration; R2 = perda do host).

## Verificação

- O restore do item 1 **foi executado de verdade**, não descrito de cabeça.
- Um leitor que nunca viu o repo consegue restaurar seguindo só o doc.
- `npm test` intocado — mudança só de docs.
- Commit: `docs(backups): document the R2 snapshot and its restore`, corpo
  citando `plans/10d`.
