# 09b — Tirar o Cloudflare D1 da documentação

> **Status: EXECUTADO** em 2026-07-17 — Removido D1 de CLAUDE.md (tech stack, backend, critical paths, footer). README.md e docs/ já não tinham referências.
> **Depende de**: `09a-d1-code-removal.md` (execute depois; sem isso a doc
> descreveria código que ainda existe).

Pré-requisito de leitura: `plans/README.md` e o §Registro de
`09a-d1-code-removal.md` (o porquê da remoção).

## Contexto

O Cloudflare D1 saiu do código em `09a`. Sobram menções em documentação, que
agora descrevem algo inexistente. Tarefa mecânica: localizar e remover, sem
reescrever conceito.

## Itens

### 1. `CLAUDE.md`

Remover as menções a D1, mantendo o resto do texto intacto:

- Bloco **"Tech Stack"** (topo, Quick Start): a linha do banco cita "SQLite
  (optional Cloudflare D1 via REST)" e "Cloudflare R2 object storage" — tirar só
  a parte do D1, o R2 fica.
- Seção **"Technology Stack" → Backend**: o bullet do SQLite menciona
  "or Cloudflare D1 via REST API when `TUDUDI_DB_DRIVER=d1` (driver em
  `/backend/db/`, no transactions, see driver header for semantics)" — reduzir ao
  SQLite.
- Tabela **"Critical Paths Quick Reference"**: apagar a linha
  `| D1 REST data layer | /backend/db/d1Client.js, /backend/db/d1RestDriver.js |`.
- Rodapé **"Last Updated"**: bump da data e do resumo (hoje cita "optional D1
  REST data layer").

### 2. `README.md` (raiz)

- Linha ~84: o changelog cita "compartilhando `CLOUDFLARE_ACCOUNT_ID` entre R2 e
  D1" — a variável **continua existindo e sendo usada pelo R2**; corrigir a frase
  para não citar D1, sem remover a variável.
- Linhas ~190-191: o exemplo de `docker-compose` passa `CLOUDFLARE_API_TOKEN`.
  Alinhar com o `docker-compose.yml` real depois do `09a` (que tira essa var do
  container). **`CLOUDFLARE_ACCOUNT_ID` fica.**
- Se houver entrada de changelog descrevendo a implantação do D1, **não apagar**
  — é registro histórico do fork; se quiser, anotar que foi revertido.

### 3. `docs/`

**Nada a fazer.** O grep de 2026-07-17 confirma que o D1 nunca chegou a ser
documentado em `/docs` (era justamente o que o `06-docs-update.md` propunha, e
esses itens já foram retirados de lá).

## Verificação

- `grep -rni "d1\|TUDUDI_DB_DRIVER" CLAUDE.md README.md docs/` não retorna nada
  (atenção a falsos positivos: palavras que contenham "d1" por acaso).
- `grep -rn "CLOUDFLARE_ACCOUNT_ID" .` — a variável **continua** presente em
  `.env.example`, `docker-compose.yml`, `backend/config/config.js` e
  `docs/15-storage.md`. Se sumiu, o `09a` errou: o R2 quebra sem ela.
- Nenhum arquivo de código tocado — `git status` deve mostrar só `.md`.
- Commit: `docs: drop the Cloudflare D1 references`, corpo citando `plans/09b`.
