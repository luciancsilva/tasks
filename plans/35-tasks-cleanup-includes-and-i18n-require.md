# 35 — cleanup: include redundante, require em loop, tipo de notificação

> **Status: PROPOSTO** — três nits de baixa severidade achados no code-review do lote 24–32. Sem risco de dados. Agrupados por serem cleanup mecânico.
> **Esforço:** Baixo · **Natureza:** mecânico · **Modelo:** fraco (haiku).
> **Branch:** `main` · **Depende de:** -

## Itens

### 35-1 — `InvolvedPeople` redundante no filtro
`backend/modules/tasks/queries/query-builders.js:~96` passou a incluir
`InvolvedPeople` (belongsToMany) além de `AssignedTo`, mas o plano 25 só pedia
`AssignedTo`. Dois belongsToMany na mesma query (junto de Tags) desperdiçam
trabalho e arriscam multiplicação de linhas (hoje mitigada por `distinct:true`).
**Ação:** remover o include de `InvolvedPeople` daqui se nenhum render desse
caminho o usa; manter só `AssignedTo`. Validar contra os renders de card.

### 35-2 — `require` dentro do loop
`backend/modules/tasks/dueTaskService.js:~121` e
`backend/modules/projects/dueProjectService.js:~123` chamam
`require('../notifications/i18n')` dentro do loop por-item. **Ação:** hoistar o
`const { t } = require('../notifications/i18n')` para o topo do módulo (require é
cacheado; é só estilo/hot-path).

### 35-3 — tipo de notificação de tarefa reativada
`backend/modules/tasks/deferredTaskService.js:~99` grava `type: 'task_due_soon'`
com conteúdo da chave `task_now_active`. **Ação:** avaliar introduzir/usar um
`type: 'task_now_active'` (ou o tipo correto já existente) para não confundir
filtros/preferências por tipo. **Cuidado:** conferir se algum filtro/preferência
depende do valor `task_due_soon` aqui antes de mudar (pode ser pré-existente e
intencional) — se for, documentar e fechar sem mudança.

## Critério de Pronto

- `npm run backend:test` verde.
- 35-1 e 35-2 sem mudança de comportamento (só cleanup); 35-3 com teste se mudar
  o `type`.
- Lint dos arquivos tocados.
