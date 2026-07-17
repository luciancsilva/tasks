# 16 — Views com filtro por status de tarefa e por pessoa ("Aguardando" / "Delegadas")

> **Prioridade: BAIXA por risco, ALTA por valor** (é o gap que impede replicar
> o fluxo GTD do TickTick) — **Esforço: médio** — **Julgamento: pouco** (a
> semântica está definida; dúvidas de UI seguem o padrão existente) —
> **Depende de: nada** (14b recomendado antes, para o MCP enxergar `waiting`)

## Contexto

O dono usa GTD com listas "⏰Aguardando" (tarefas em `waiting`) e "📌Delegadas"
(por pessoa). O modelo já suporta os dois conceitos:
- `Task.status` tem `waiting` = 4 (`backend/models/task.js:378-390`);
- `Task.assigned_to` guarda o `uid` de `Person` (`backend/models/task.js:209-217`;
  associações em `models/index.js:313-330`).

Mas **Views** (saved searches fixáveis na sidebar, `docs/08-views-system.md`)
só filtram completion status `active|completed|all`
(`frontend/components/ViewDetail.tsx:178-193`) além de tags/priority/due. Não
há como salvar uma view de status `waiting` nem de pessoa.

Pontos de extensão já existentes (sem migration):
- `backend/models/view.js` tem o campo JSON **`extras`** (TEXT com
  get/set JSON) — guardar ali `task_status` e `assigned_to`;
- `backend/modules/views/service.js:28-75` já repassa campos do payload
  (create/update) — incluir `extras`;
- o filtro em si é client-side no `ViewDetail.tsx` (o componente busca as
  tasks e filtra) — seguir esse padrão, não inventar endpoint novo.

## O que fazer

### 1. Baseline
```bash
npm run backend:test && npm run frontend:test
```

### 2. Backend — aceitar e persistir os novos filtros

- Conferir em `backend/modules/views/service.js` se `extras` já é aceito no
  create/update (o model tem o campo; o service repassa `filters`, `tags`,
  `priority`, `due`...). Se não estiver na lista de campos, adicionar `extras`
  em create e update.
- Validação (`backend/modules/views/validation.js`): se `extras.task_status`
  vier, exigir um de
  `['not_started','in_progress','done','archived','waiting','cancelled','planned']`;
  se `extras.assigned_to` vier, exigir string não vazia. Campos ausentes =
  sem filtro (retrocompat total com views existentes).
- Teste de integração: já existe suíte de views? (`backend/tests/` — procurar
  `views`; se não houver, criar `backend/tests/integration/views-extras.test.js`
  no padrão de `areas.test.js`): criar view com
  `extras: { task_status: 'waiting' }`, ler de volta, verificar round-trip.

### 3. Frontend — SaveViewModal

`frontend/components/UniversalSearch/SaveViewModal.tsx` já envia
`filters/priority/due/tags`. Adicionar ao payload `extras` com:
- `task_status` — select com os status de tarefa (usar as chaves i18n de
  status já existentes; conferir `frontend/components/Shared/StatusDropdown.tsx`
  para reusar labels);
- `assigned_to` — select de pessoas (fonte: onde o app já lista People para
  o campo "Atribuído a" do TaskModal — localizar o componente/endpoint
  `/api/people` e reusar o mesmo fetch/store).

### 4. Frontend — ViewDetail aplicar os filtros

Em `frontend/components/ViewDetail.tsx`, junto do filtro de completion
(linhas ~178-193):
- se `view.extras?.task_status` presente: manter só tasks cujo status
  normalizado bata (atenção: tasks chegam com status string OU número — o
  arquivo já trata os dois; usar o mesmo padrão de comparação dupla);
- se `view.extras?.assigned_to` presente: manter só tasks com
  `task.assigned_to === extras.assigned_to` (conferir se o serializer inclui
  `assigned_to`; se não incluir, adicioná-lo em
  `backend/modules/tasks/core/serializers.js`);
- exibir os filtros ativos nos chips do cabeçalho da view (padrão dos chips de
  tags/filters existente no mesmo arquivo, linhas ~739-800).

### 5. Teste frontend

Na suíte frontend (padrão `frontend/components/Profile/tabs/__tests__/`),
teste de `ViewDetail` cobrindo: view com `extras.task_status='waiting'` mostra
só as waiting; com `assigned_to` mostra só as da pessoa. Se `ViewDetail` for
pesado de montar, testar a função de filtragem extraída (extrair a filtragem
para função pura exportada é aceitável e preferível).

### 6. Validação e lint
```bash
npm run backend:test && npm run frontend:test
cd backend && npx eslint modules/views/service.js modules/views/validation.js
# lint dos .tsx tocados individualmente com npx eslint
```

## Critério de pronto

- [ ] View salva com `extras.task_status='waiting'` e fixada na sidebar mostra exatamente as tarefas em waiting.
- [ ] View com `extras.assigned_to=<uid de person>` mostra só as tarefas daquela pessoa.
- [ ] Views antigas (sem extras) continuam idênticas.
- [ ] Testes novos backend + frontend; suítes verdes; lint limpo.

## Commit

`feat(views): filter saved views by task status and assigned person` — corpo
citando "Implements plans/16". Sem push. Mesmo commit: banner EXECUTADO +
tabela do README.

## Fora de escopo

- Grupos/hierarquia de views, seed automático de views GTD (o dono cria as
  views na UI — o guia é o plano 17).
- Qualquer mudança no MCP (14b cuida do `waiting` lá).
