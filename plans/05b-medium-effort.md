# 05b — Melhorias de esforço MÉDIO

Origem: itens do levantamento `05-future-improvements.md`, segregados por esforço.
Itens desta faixa tocam mais de um módulo ou exigem migração, mas cabem em uma
sessão de trabalho focada com a suíte de testes como rede. Regras: `plans/README.md`.

---

## ME-1. Eliminar `PRAGMA foreign_keys = OFF` global no delete de tarefa

- **Onde**: `backend/modules/tasks/routes.js` (handler `DELETE /task/:uid`);
  padrão repetido em `backend/modules/projects/repository.js` (`deleteWithOrphaning`).
- **Por quê (alta prioridade)**: o PRAGMA atua na conexão compartilhada fora de
  transação; requisição concorrente pode rodar sem enforcement, e crash entre
  OFF e ON deixa a conexão sem FKs. Também é semanticamente diferente no modo
  D1 (vira `defer_foreign_keys`, escopo por request).
- **Como**: substituir por deleção explícita em ordem reversa de dependência
  dentro de `sequelize.transaction` — anexos (já feito), task_events, tasks_tags,
  recurring_completions, caldav_sync_state/overrides, subtasks, por fim a task.
  Remover o par PRAGMA OFF/ON. Mesma cirurgia no fluxo de projeto.
- **Riscos**: mapear TODAS as FKs que apontam para `tasks` antes (grep nas
  migrations por `references.*tasks`); teste de delete com cada tipo de dependente.
- **Esforço**: médio. **Dependência**: nenhum, mas facilita ME-2 e ME-3.

## ME-2. Side effects externos fora da transação de banco

- **Onde**: `backend/modules/projects/repository.js` (`deleteWithOrphaning` chama
  `r2Service.deleteObject` dentro de `sequelize.transaction`).
- **Por quê**: rollback não desfaz delete no bucket; storage lento segura o lock
  de escrita do SQLite.
- **Como**: dentro da transação apenas coletar as keys (attachments + capa);
  executar os `deleteObject` após o commit bem-sucedido. Atualizar
  `deleteAttachmentsForTaskIds` para aceitar modo "collect keys" ou dividir em
  duas fases (rows na transação, objetos depois).
- **Testes**: os testes de `project-image-cleanup.test.js` e
  `task-attachments.test.js` continuam valendo; adicionar caso de rollback
  (falha no meio) confirmando que objetos NÃO foram deletados.
- **Esforço**: médio. **Dependência**: idealmente após ME-1.

## ME-3. FKs com `ON DELETE CASCADE` reais e confiáveis

- **Onde**: migrations de `task_attachments` (já tem CASCADE), `task_events`,
  `tasks_tags`, `recurring_completions`, caldav_*.
- **Por quê**: hoje o código deleta dependentes manualmente porque as FKs ficam
  desligadas no fluxo; com ME-1 feito, cascatas declaradas passam a disparar de
  verdade e o código manual pode encolher.
- **Como**: auditar cada FK que referencia `tasks`/`projects`; criar migration
  (SQLite: recriar tabela) apenas onde faltar CASCADE e a semântica desejada for
  cascade mesmo (events sim; tags junction sim). Depois remover deletes manuais
  redundantes.
- **Riscos**: recriação de tabela em SQLite exige cuidado com índices; no modo D1
  a migration roda por REST (sem transação real) — janela de inconsistência.
- **Esforço**: médio. **Dependência**: ME-1 primeiro.

## ME-4. Padronizar tratamento de erro no módulo tasks

- **Onde**: `backend/modules/tasks/routes.js` (ex.: delete responde
  `res.status(400)` genérico e descarta o erro original, sem `logError`).
- **Por quê**: módulos novos usam `next(error)` + `shared/middleware/errorHandler`;
  o tasks engole diagnóstico.
- **Como**: nos handlers do tasks, capturar → `logError` + `next(error)`;
  garantir que o errorHandler mapeia `NotFoundError`/`ValidationError`/etc.
  Manter formato de resposta atual onde os testes o exigem.
- **Esforço**: médio (muitos handlers, mudança mecânica).

## ME-5. Decidir destino do BaseRepository

- **Onde**: `backend/shared/database/BaseRepository.js` e os
  `backend/modules/*/repository.js`.
- **Por quê**: camada fina que metade dos módulos contorna — indireção sem garantia.
- **Como**: decidir e aplicar UMA direção: (a) enriquecer (paginação, escopos de
  permissão, helpers de include) e migrar módulos, ou (b) remover a classe e
  deixar repositories planos. Recomendação: (b), menor custo, ganho imediato de
  legibilidade.
- **Esforço**: médio.

## ME-6. Renomear locales fora do padrão BCP-47 (`jp`→`ja`, `ua`→`uk`)

- **Onde**: `public/locales/jp/`, `public/locales/ua/`; referências em
  `frontend/i18n.ts`, dropdown de idiomas, coluna `language` de users.
- **Por quê**: códigos incorretos quebram interop (navegador, bibliotecas).
- **Como**: renomear diretórios; aliases de compatibilidade no i18next
  (`load: ...`, mapa de fallback); migration de dados atualizando
  `users.language` ('jp'→'ja', 'ua'→'uk').
- **Riscos**: preferência salva de usuários existentes — migration obrigatória.
- **Esforço**: médio.
