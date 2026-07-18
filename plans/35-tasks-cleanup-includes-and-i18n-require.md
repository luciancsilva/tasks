# 35 — cleanup: tipo de notificação de tarefa reativada

> **Status: PARCIAL** — 35-2 EXECUTADO em 2026-07-18 (require hoisted). 35-1 fechado sem mudança (o include NÃO era redundante). Sobra o 35-3. Achados no code-review do lote 24–32.
> **Esforço:** Baixo · **Natureza:** julgamento (o tipo pode ser intencional) · **Modelo:** médio.
> **Branch:** `main` · **Depende de:** -

## Resolvidos

- **35-1 (fechado, sem mudança)** — o include `InvolvedPeople` em
  `query-builders.js` **não** é redundante: `TaskHeader` renderiza chips de
  `InvolvedPeople` nos cards de lista, então o include popula esses chips no
  caminho de filtro (Hoje/Próximos/Todas). Falso-positivo do review.
- **35-2 (EXECUTADO)** — `const { t } = require('../notifications/i18n')` hoisted
  para o topo de `dueTaskService.js` e `dueProjectService.js`; chamada no loop
  passou a usar `t(...)`. Backend 127/1709 verde.

## Aberto

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
