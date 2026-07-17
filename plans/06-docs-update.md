# 06 — Update completo do /docs/

Objetivo: alinhar toda a documentação interna (`/docs`, 26 arquivos) com o estado
real do código após as mudanças de 2026-07 (storage R2, limpeza de anexos,
branding, limpeza do fork). Plano executável por agente em uma sessão; regras
gerais em `plans/README.md`.

> **Atenção ao executar**: este plano foi escrito em 2026-07-16, antes da remoção
> do Cloudflare D1 (`plans/09-d1-removal.md`). Os itens de D1 já foram retirados
> daqui. Validar o status real dos demais antes de mexer — o passo 1
> (`docs/15-storage.md`) aparenta já estar executado.

## Diagnóstico do gap atual

1. **Storage**: docs assumem disco local em vários pontos; código usa R2
   (`backend/services/r2Service.js`) para anexos, avatares, capas e branding.
   Não existe doc dedicada de storage.
2. **Branding**: feature nova (commit `887e486`) sem doc — endpoints públicos e
   admin, chaves na tabela `settings`, fallback, aba no Profile.
3. **Comportamento de deleção**: `docs/00-tasks-behavior.md` e `docs/06-projects.md`
   descrevem deleção sem a limpeza de R2 e sem a nova regra "subtasks são
   deletadas junto com o pai" (commits `fe4e165`, `b707dce`).
4. **directory-structure.md**: referencia `screenshots/` (removido em `d553e1b`),
   não lista `backend/db/`, `backend/modules/branding/`, `plans/`.
5. **testing.md**: contagens/estruturas podem estar defasadas (conferir a suíte
   atual; mocks R2 com `aws-sdk-client-mock`).
6. **MEMORY.md**: revisar se preferências continuam válidas (estão).
7. **Env vars canônicas** (adicionado 2026-07-16): docs que citarem variáveis
   `R2_*` devem migrar para os nomes `CLOUDFLARE_*` (commit `09aaa77`; legados
   seguem como fallback). Referenciar `.env.example` (commit `06b0466`) como
   fonte canônica de setup de credenciais em vez de duplicar instruções.

## Execução (ordem)

1. **Nova doc** `docs/15-storage.md`: prefixos de key (`tasks/`, `avatars/`,
   `projects/`, `branding/`), proxy autenticado `/api/uploads/:prefix/:filename`,
   rota pública de branding, contrato best-effort do `deleteObject`, limpeza em
   deleção (tarefa/subtask/projeto/capa), variáveis R2.
2. **Nova doc** `docs/16-branding.md`: modelo (settings globais), endpoints,
   permissões (admin), fallback, i18n, limitação do manifest PWA.
3. **Atualizar** `docs/00-tasks-behavior.md` (deleção: anexos R2 + subtasks
   deletadas) e `docs/06-projects.md` (deleção/troca de capa limpa R2).
4. **Atualizar** `docs/directory-structure.md`: remover `screenshots/`, adicionar
   `backend/db/`, `backend/modules/branding/`, `plans/`, raiz atual do fork.
5. **Atualizar** `docs/testing.md`: mocks R2, contagens.
6. **Atualizar** `CLAUDE.md`: índice de docs ganha 15-storage e 16-branding;
   bump de "Last Updated".
7. **Varredura final**: `grep -ri "uploads/" docs/`, `grep -ri sqlite docs/`,
   `grep -ri screenshot docs/` para pegar sobras; conferir links internos.

`docs/backups.md` não entra aqui: o `plans/10-db-backup-r2.md` já o cobre (§10-5).

## Critério de pronto

- Nenhuma referência a arquivo/fluxo inexistente (`screenshots/`, disco local
  para uploads sem menção a R2).
- Toda feature nova de 2026-07 tem doc própria ou seção.
- Índice do `CLAUDE.md` espelha exatamente os arquivos de `/docs`.
- `npm test` intocado (mudança só de docs) — nenhum código alterado.
