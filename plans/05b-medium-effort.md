# 05b — Melhorias de esforço MÉDIO [CONCLUÍDO]

Origem: itens do levantamento `05-future-improvements.md`, segregados por esforço.
Itens desta faixa tocam mais de um módulo ou exigem migração, mas cabem em uma
sessão de trabalho focada com a suíte de testes como rede. Regras: `plans/README.md`.

---

## [CONCLUÍDO] ME-3. FKs com `ON DELETE CASCADE` reais e confiáveis

- **Onde**: migrations de `task_attachments` (já tem CASCADE), `task_events`,
  `tasks_tags`, `recurring_completions`, caldav_*.
- **Por quê**: hoje o código deleta dependentes manualmente porque as FKs ficam
  desligadas no fluxo; com ME-1 feito, cascatas declaradas passam a disparar de
  verdade e o código manual pode encolher.
- **Como**: auditar cada FK que referencia `tasks`/`projects`; criar migration
  (SQLite: recriar tabela) apenas onde faltar CASCADE e a semântica desejada for
  cascade mesmo (events sim; tags junction sim). Depois remover deletes manuais
  redundantes.
- **Riscos**: recriação de tabela em SQLite exige cuidado com índices.
- **Esforço**: médio. **Dependência**: ME-1 primeiro.

## [CONCLUÍDO] ME-4. Padronizar tratamento de erro no módulo tasks

- **Onde**: `backend/modules/tasks/routes.js` (ex.: delete responde
  `res.status(400)` genérico e descarta o erro original, sem `logError`).
- **Por quê**: módulos novos usam `next(error)` + `shared/middleware/errorHandler`;
  o tasks engole diagnóstico.
- **Como**: nos handlers do tasks, capturar → `logError` + `next(error)`;
  garantir que o errorHandler mapeia `NotFoundError`/`ValidationError`/etc.
  Manter formato de resposta atual onde os testes o exigem.
- **Esforço**: médio (muitos handlers, mudança mecânica).

## [CONCLUÍDO] ME-5. Decidir destino do BaseRepository

- **Onde**: `backend/shared/database/BaseRepository.js` e os
  `backend/modules/*/repository.js`.
- **Por quê**: camada fina que metade dos módulos contorna — indireção sem garantia.
- **Como**: decidir e aplicar UMA direção: (a) enriquecer (paginação, escopos de
  permissão, helpers de include) e migrar módulos, ou (b) remover a classe e
  deixar repositories planos. Recomendação: (b), menor custo, ganho imediato de
  legibilidade.
- **Esforço**: médio.

## [CONCLUÍDO] ME-6. Renomear locales fora do padrão BCP-47 (`jp`→`ja`, `ua`→`uk`)

- **Onde**: `public/locales/jp/`, `public/locales/ua/`; referências em
  `frontend/i18n.ts`, dropdown de idiomas, coluna `language` de users.
- **Por quê**: códigos incorretos quebram interop (navegador, bibliotecas).
- **Como**: renomear diretórios; aliases de compatibilidade no i18next
  (`load: ...`, mapa de fallback); migration de dados atualizando
  `users.language` ('jp'→'ja', 'ua'→'uk').
- **Riscos**: preferência salva de usuários existentes — migration obrigatória.
- **Esforço**: médio.
