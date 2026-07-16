# 06 — Update completo do /docs/

Objetivo: alinhar toda a documentação interna (`/docs`, 26 arquivos) com o estado
real do código após as mudanças de 2026-07 (storage R2, limpeza de anexos,
branding, driver Cloudflare D1, limpeza do fork). Plano executável por agente em
uma sessão; regras gerais em `plans/README.md`.

## Diagnóstico do gap atual

1. **Storage**: docs assumem disco local em vários pontos; código usa R2
   (`backend/services/r2Service.js`) para anexos, avatares, capas e branding.
   Não existe doc dedicada de storage.
2. **Camada de dados**: `docs/database.md` e `docs/architecture.md` descrevem só
   SQLite local; falta o modo `TUDUDI_DB_DRIVER=d1` (driver REST, limitações de
   transação, rate limit) introduzido em `5e705e8`.
3. **Branding**: feature nova (commit `887e486`) sem doc — endpoints públicos e
   admin, chaves na tabela `settings`, fallback, aba no Profile.
4. **Comportamento de deleção**: `docs/00-tasks-behavior.md` e `docs/06-projects.md`
   descrevem deleção sem a limpeza de R2 e sem a nova regra "subtasks são
   deletadas junto com o pai" (commits `fe4e165`, `b707dce`).
5. **directory-structure.md**: referencia `screenshots/` (removido em `d553e1b`),
   não lista `backend/db/`, `backend/modules/branding/`, `plans/`.
6. **backups.md**: backup por cópia de arquivo SQLite não se aplica ao modo D1;
   falta seção "modo D1: usar export do Cloudflare".
7. **testing.md**: contagens/estruturas podem estar defasadas (suíte hoje:
   ~1667 backend, 65 frontend; mocks R2 com `aws-sdk-client-mock`; emulador D1).
8. **MEMORY.md**: revisar se preferências continuam válidas (estão).
9. **Env vars canônicas** (adicionado 2026-07-16): docs que citarem variáveis
   `R2_*`/`D1_*` devem migrar para os nomes `CLOUDFLARE_*` (commit `09aaa77`;
   legados seguem como fallback). Referenciar `.env.example` (commit `06b0466`)
   como fonte canônica de setup de credenciais em vez de duplicar instruções.
10. **Ativação D1 executada** (adicionado 2026-07-16): `docs/database.md` deve
   refletir que o modo D1 está operacional e apontar para as lições em
   `plans/07-d1-activation.md` (bootstrap sync-first, PRAGMAs case-sensitive,
   derivação de credenciais R2).

## Execução (ordem)

1. **Nova doc** `docs/15-storage.md`: prefixos de key (`tasks/`, `avatars/`,
   `projects/`, `branding/`), proxy autenticado `/api/uploads/:prefix/:filename`,
   rota pública de branding, contrato best-effort do `deleteObject`, limpeza em
   deleção (tarefa/subtask/projeto/capa), variáveis R2.
2. **Nova doc** `docs/16-branding.md`: modelo (settings globais), endpoints,
   permissões (admin), fallback, i18n, limitação do manifest PWA.
3. **Atualizar** `docs/database.md` + `docs/architecture.md`: seção "Cloudflare D1
   via REST" (flag, envs, driver `backend/db/d1RestDriver.js`, no-op de
   transações, `defer_foreign_keys`, rate limit 1100/5min, latência por request).
4. **Atualizar** `docs/00-tasks-behavior.md` (deleção: anexos R2 + subtasks
   deletadas) e `docs/06-projects.md` (deleção/troca de capa limpa R2).
5. **Atualizar** `docs/directory-structure.md`: remover `screenshots/`, adicionar
   `backend/db/`, `backend/modules/branding/`, `plans/`, raiz atual do fork.
6. **Atualizar** `docs/backups.md`: nota do modo D1.
7. **Atualizar** `docs/testing.md`: mocks R2, testes unitários D1, contagens.
8. **Atualizar** `CLAUDE.md`: índice de docs ganha 15-storage e 16-branding;
   bump de "Last Updated".
9. **Varredura final**: `grep -ri "uploads/" docs/`, `grep -ri sqlite docs/`,
   `grep -ri screenshot docs/` para pegar sobras; conferir links internos.

## Critério de pronto

- Nenhuma referência a arquivo/fluxo inexistente (`screenshots/`, disco local
  para uploads sem menção a R2).
- Toda feature nova de 2026-07 tem doc própria ou seção.
- Índice do `CLAUDE.md` espelha exatamente os arquivos de `/docs`.
- `npm test` intocado (mudança só de docs) — nenhum código alterado.
