# 25 — exibir pessoa atribuída em cards e detalhe

> **Status: PROPOSTO** — a pessoa atribuída (`assigned_to` / "ATRIBUÍDO A") não aparece nos cards (Hoje/Próximos/Todas) nem no topo do detalhe; a API sequer carrega a associação. Adicionar include + render.
> **Esforço:** Baixo · **Natureza:** mecânico (include + render por padrão existente) · **Modelo:** fraco/médio.
> **Branch:** `main` · **Depende de:** -

## Decisão de produto

`@pessoa` = **`assigned_to`** (single, o card "ATRIBUÍDO A"). Cards e topo do
detalhe exibem o assignee. (`InvolvedPeople` é feature m2m separada de @menções e
fica como está.)

## Diagnóstico

A task tem dois campos de pessoa: `assigned_to` (single, FK → `people.uid`,
`backend/models/task.js:209-217`, associação `as:'AssignedTo'` em
`backend/models/index.js:330-334`) e `InvolvedPeople` (m2m).

`TASK_INCLUDES` (`backend/modules/tasks/utils/constants.js:3-26`) carrega Tag,
Project, Area e `InvolvedPeople` — **falta `AssignedTo`**. A API devolve só a
string `assigned_to` (uid), sem nome/cor pra renderizar chip.

Render (nenhum mostra assignee hoje):
- Card `frontend/components/Task/TaskHeader.tsx`: tags/pessoas/data em `288-308`
  (upcoming/Próximos), `364-392` (Hoje/Todas), `526-552` (mobile); helper de chip
  de pessoa (usa `InvolvedPeople`) `173,185-201`; gate `hasMetadata` `175-183`.
- Detalhe `frontend/components/Task/TaskDetails/TaskDetailsHeader.tsx:514-581`
  (projeto + tags, sem assignee). O assignee só existe no card editável inferior
  `TaskDetails/TaskAssignedToCard.tsx`.

## Implementação Proposta

1. **Backend**: adicionar ao `TASK_INCLUDES` (herdado por
   `TASK_INCLUDES_WITH_SUBTASKS`) a associação:
   ```js
   { model: Person, as: 'AssignedTo', attributes: ['id','name','uid','color'], required: false }
   ```
   Confirmar que os serializers/controllers repassam o objeto no payload.
2. **Frontend `TaskHeader`**: renderizar chip de assignee (ícone pessoa + nome,
   cor `AssignedTo.color` se houver) nas 3 variações (upcoming/Hoje/mobile),
   reutilizando o estilo do chip de pessoa existente; incluir no `hasMetadata`.
3. **Frontend detalhe**: renderizar assignee ao lado das tags em
   `TaskDetailsHeader.tsx` (514-581).
4. **Tipo**: `frontend/entities/Task.ts` — adicionar `AssignedTo?` se faltar.

## Critério de Pronto

- Baseline `npm run backend:test` + `npm run frontend:test`.
- Testes: backend — include retorna `AssignedTo` com nome. Frontend — `TaskHeader`
  mostra chip quando `AssignedTo` presente, não quando ausente.
- Verificação manual: tarefa com pessoa em ATRIBUÍDO A mostra chip no card
  (Hoje/Próximos/Todas) e no topo do detalhe.
- Lint dos arquivos tocados.
