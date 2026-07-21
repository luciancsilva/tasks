# 76a — Revisão Semanal: usar a lista de tarefas real, não uma prévia

> **Status: PROPOSTO** em 2026-07-21 — reportado pelo dono: a tela "não é útil e
> efetiva, não permite drag and drop, não mostra se a tarefa está vencida,
> não permite alterar a data de vencimento sem abrir a tarefa, não mostra tags,
> não permite múltiplas seleções".
> **Esforço:** Médio · **Natureza:** mecânico (o difícil já existe) · **Modelo:**
> médio · **Branch:** `main` · **Depende de:** 54b (seções), 63 (bulk), 61 (drag).

## Diagnóstico

Nenhuma das 5 lacunas é funcionalidade nova. **Todas já existem** no
`TaskList`/`TaskItem` que o resto do app usa — a Revisão Semanal simplesmente
não os usa. Ela reimplementou uma linha própria, `ReviewItemRow`
(`frontend/components/Review/ReviewSection.tsx:17`), que renderiza um `<button>`
com nome + um badge de dias e nada mais.

`frontend/components/Task/TaskList.tsx:23-46` já expõe:

| Lacuna do dono | Prop que já resolve |
|---|---|
| drag and drop | `enableDrag` + `onReorder` (plano 61) |
| múltiplas seleções | `selectable` + `selectedUids` + `onToggleSelect` (plano 63) |
| tags vinculadas | `TaskItem` → `TaskTags` |
| vencida ou não | `TaskDueDate` — borda vermelha quando `dueDate < today` |
| alterar data sem abrir | **não existe ainda** → plano 76b |

A causa raiz está no backend: `reviews/service.js:107-200` busca com
`raw: true` e achata cada item para `{uid, name, type, href, meta}`. Sem tags,
sem projeto, sem `due_date`, sem prioridade — e sem o shape que `TaskItem`
espera. Enquanto o payload for esse, nenhuma tela consegue ser melhor.

## 1. Baseline
```bash
npm run backend:test && npm run frontend:test && npx tsc --noEmit
npx webpack --config webpack.config.js --mode development
```

## 2. Backend — devolver Tasks serializadas

`backend/modules/reviews/service.js`:

1. Tire o `raw: true` das três queries de Task (`waitingTasks`, `somedayTasks`,
   `upcomingTasks`) e de `_findStaleTasks`, e some `include: TASK_INCLUDES`
   (`require('../tasks/utils/constants')`).
2. Serialize com o mesmo serializador das outras rotas:
   ```js
   const { serializeTasks } = require('../tasks/core/serializers');
   // no topo de getSections, tz vem do controller (já é passado e ignorado hoje)
   const items = await serializeTasks(staleTasks.slice(0, 20), tz);
   ```
3. Cada seção passa a devolver `items` = array de Task serializada. **Mantenha**
   `count`, `href`, `title_key` e `follow_up_overdue_count` como estão — a
   contagem continua vindo do total, não do slice.
4. `meta` sai: `days_stale`/`waiting_since_days` são deriváveis de `updated_at`
   e `waiting_since`, que agora vêm na Task.
5. Seções `stalled` (projetos) e `goals` **não** são Tasks — mantenha o formato
   achatado atual e marque com `kind: 'project'` / `kind: 'goal'`. As de tarefa
   ganham `kind: 'task'`. O frontend decide o renderer pelo `kind`.
6. `getSections(userId, tz)` já recebe `tz` do controller (`controller.js:37`) e
   hoje ignora — passe adiante para `serializeTasks`.

> Atenção ao N+1: `serializeTasks` já faz batch de parent UIDs (plano 72). Com
> 7 seções × 20 itens o custo é aceitável, mas confira o log de query numa
> conta com volume antes de fechar.

## 3. Frontend — trocar o renderer

`frontend/utils/reviewsService.ts`: `ReviewSectionData.items` passa a
`Task[] | ReviewFlatItem[]`, com `kind` discriminando.

`frontend/components/Review/ReviewSection.tsx`:
- Quando `section.kind === 'task'`, renderize `<TaskList>` no lugar do `.map`
  de `ReviewItemRow`, com:
  ```tsx
  <TaskList
      tasks={section.items as Task[]}
      projects={projects}
      onTaskUpdate={onTaskUpdate}
      onTaskDelete={onTaskDelete}
      selectable
      selectedUids={selectedUids}
      onToggleSelect={onToggleSelect}
      enableDrag={false}
      hideProjectName={false}
  />
  ```
- `ReviewItemRow` fica só para projeto e meta.
- `enableDrag` fica `false` nesta fase: ordenar dentro de uma seção de revisão
  não tem destino de persistência (`today_order` é da tela Hoje). O drag útil
  aqui é **arrastar para reprogramar**, que é o 76b.

`frontend/components/Review/WeeklyReview.tsx`:
- Estado `selectedUids: Set<string>` no topo, compartilhado por todas as seções
  (seleção atravessa seções — é uma fila só).
- Monte `<BulkToolbar>` (`components/Task/BulkToolbar.tsx`) com
  `onBulkComplete`/`onBulkDelete` chamando `bulkUpdateTasks`/`bulkDeleteTasks`
  de `utils/tasksService` (já corrigidos em `d57bf64e`), depois `mutate()` do SWR.
- `projects` para o `TaskList`: `fetchProjects()` uma vez no topo.

## 4. Chips de filtro no lugar da pilha de cards

Modelo da referência (Mindwtr): uma barra de chips com contagem
(`Todos (8) · Caixa de entrada (2) · Próximo (6) · Aguardando (0) …`) e **uma
lista só** abaixo, em vez de 7 cards empilhados que obrigam a rolar.

- Chip ativo filtra a lista; `Todos` concatena todas as seções de tarefa.
- Mantenha o checkbox de "seção revisada" no chip, não na linha — é o que marca
  progresso do ritual.
- O contador do chip vem de `section.count` (total), não de `items.length`.

## 5. i18n
Chaves novas em `public/locales/{en,pt}/translation.json`, bloco `review`:
`review.filterAll`, `review.selectMode`, `review.noneInSection`.
Nunca deixe fallback inglês — ver `docs/MEMORY.md`.

## 6. Testes
- Backend: em `reviews`, asserir que `items[0]` de `waiting` traz `tags`,
  `due_date` e `Project`, e que `count` continua sendo o total (não o slice).
- Frontend: render de `WeeklyReview` com uma seção de tarefa mostra a tag e a
  data; selecionar dois itens mostra o `BulkToolbar` com "2".

## 7. Lint
```bash
cd backend && npx eslint --fix modules/reviews/service.js modules/reviews/controller.js
cd frontend && npx eslint --fix components/Review/WeeklyReview.tsx components/Review/ReviewSection.tsx utils/reviewsService.ts
```

## Critério de pronto
- [ ] Seções de tarefa renderizam com tags, projeto, prioridade e vencimento.
- [ ] Vencida aparece em vermelho sem abrir a tarefa.
- [ ] Seleção múltipla atravessa seções e o `BulkToolbar` age sobre ela.
- [ ] Chips substituem a rolagem de 7 cards.
- [ ] `count` = total; `items` = amostra. Não confunda os dois.
- [ ] Suítes verdes + `tsc --noEmit` + **webpack build** (ver napkin).

## Commit
`feat(reviews): render real task rows in the weekly review` — "Implements
plans/76a".

## Fora de escopo
- Alterar data inline e menu de ação rápida → **76b**.
- Reordenar por drag dentro da seção (sem destino de persistência hoje).
