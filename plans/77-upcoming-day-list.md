# 77 — Próximos: lista por dia, rotinas colapsadas, arrastar para reprogramar

> **Status: PROPOSTO** em 2026-07-21 — reportado pelo dono: "a UI ainda não está
> legal, muito completo e pouco efetivo". Direção escolhida por ele: **lista
> agrupada por dia**, com **drag entre dias no mesmo plano** e **rotinas
> colapsadas em "+N rotinas"**.
> **Esforço:** Médio · **Natureza:** julgamento (UX) + mecânico (layout) ·
> **Modelo:** médio · **Branch:** `main` · **Depende de:** 52 (`time_estimate`).

## Diagnóstico

A tela já usa `GroupedTaskList` com `selectable` (`Tasks.tsx:944-964`). O
problema é uma linha de layout:

```tsx
// GroupedTaskList.tsx:328-334
<div className="flex flex-col md:flex-row gap-4 md:gap-6 w-full">
    <div className="day-column w-full md:flex-1 md:min-w-64">
```

7 colunas × `min-w-64` (256px) + 6 gaps de 24px ≈ **1936px**. Acima de qualquer
viewport comum, então a semana só cabe com scroll horizontal e cada título
trunca. O empilhamento vertical **já existe** — é o `flex-col` do mobile.

Os outros três problemas da tela:

1. **Rotina domina.** "Tomar vitamina D" e "TESTE HABITO" ocupam 6 das 7
   colunas; o trabalho real vira minoria visual.
2. **Não responde "quanto tem em cada dia?"** — sem contagem e sem soma de
   `time_estimate`, que existe desde o plano 52.
3. **Metade da tela vazia**: conteúdo termina em ~500px de 1080, e ainda assim
   há scroll lateral. Pior dos dois mundos.

## 1. Baseline
```bash
npm run backend:test && npm run frontend:test && npx tsc --noEmit
npx webpack --config webpack.config.js --mode development
```

## 2. Layout — empilhar os dias

`frontend/components/Task/GroupedTaskList.tsx:328`:

- Troque `flex flex-col md:flex-row` por `flex flex-col` e remova
  `md:flex-1 md:min-w-64` da `.day-column`. Some `max-w-4xl mx-auto` no
  contêiner para a linha não esticar demais em monitor largo.
- Esse componente também serve outras telas. Guarde o comportamento novo atrás
  de uma prop `layout?: 'board' | 'stack'` (default `'board'`, preservando o que
  existe) e passe `layout="stack"` só do ramo `type === 'upcoming'` em
  `Tasks.tsx:945`.

## 3. Cabeçalho de dia com carga

No header de cada grupo (`GroupedTaskList.tsx:337-341`), hoje só o nome:

```
HOJE · 6 tarefas · ~2h                                    ▾
```

- Contagem: `dayTasks.length` **depois** de separar rotinas (ver §4) — conte o
  trabalho real, não a rotina.
- Tempo: soma de `time_estimate` (minutos, `entities/Task.ts:68`) dos itens do
  dia; omita o segmento inteiro se a soma for 0. Formate `~2h`, `~45min`.
- Cabeçalho sticky (`sticky top-0 z-10` + fundo sólido) para não perder o dia ao
  rolar.
- `▾` colapsa o dia inteiro; guarde o estado em `useState`, sem persistir.

## 4. Rotinas colapsadas

Considere rotina a tarefa que casar qualquer uma:
`habit_mode === true` · `recurring_parent_id != null` ·
`recurrence_type` presente e diferente de `'none'` (`entities/Task.ts:27,35,51`).

- Separe em dois arrays por dia: `work` e `routine`.
- `work` renderiza normal; `routine` vira **uma linha** ao final do dia:
  `+3 rotinas ▸`, que expande in-place mostrando os `TaskItem` normais.
- Estado de expansão por dia, `useState<Set<string>>`, sem persistir.
- Se o dia só tiver rotina, mostre a linha colapsada mesmo assim — o dia não
  pode sumir da lista.

## 5. Arrastar entre dias para reprogramar

`dnd-kit` já é dependência (`@dnd-kit/core`, `sortable`, `utilities`,
`modifiers`) e `TaskList` já faz drag (plano 61) — o que falta é **destino de
soltura**.

- Envolva a lista de dias num único `DndContext`.
- Cada grupo de dia é um `useDroppable` com `id = groupName`; cada `TaskItem` de
  `work` é um `useDraggable`.
- No `onDragEnd`, se `over.id !== active.data.current.groupName`, monte a data
  alvo e chame o `onTaskUpdate` que o componente já recebe:
  ```js
  await onTaskUpdate({ ...task, due_date: targetDateString });
  ```
- **A data alvo tem que sair do payload, não do label.** O agrupamento vem
  pronto do backend (`groupedTasks`) e as chaves são rótulos traduzidos
  ("Amanhã", "Quinta-feira, julho 23") — fazer parse disso quebra em outro
  idioma. Faça o backend devolver, junto de cada grupo, a data ISO do dia
  (`operations/list.js:140`, onde `serialized[groupName]` é montado), ou mude a
  chave do grupo para `YYYY-MM-DD` e traduza só na renderização. **Prefira a
  segunda**: rótulo é apresentação, chave é dado.
- Update otimista com revert no catch, como no toggle de conclusão.
- Rotina colapsada **não** é arrastável na v1: mexer em `due_date` de instância
  recorrente tem semântica própria (ver `docs/01-recurring-tasks-behavior.md`) e
  não cabe aqui.

## 6. Densidade (opcional, se sobrar fôlego)

Toggle `[densidade ▾]` no topo alternando `compacta` (só título + indicador de
vencimento) e `completa` (atual). Persistir em `ui_settings` do usuário, que já
existe (`models/user.js`). Fora do caminho crítico — corte se atrasar.

## 7. i18n
Bloco `upcoming.*` em en **e** pt: `routinesCollapsed` (com `{{count}}`),
`taskCount`, `estimatedTime`, `density`, `densityCompact`, `densityFull`.
Sem fallback inglês — `docs/MEMORY.md`.

## 8. Testes
- Frontend: render de `GroupedTaskList` com `layout="stack"` não produz
  `md:flex-row`; um dia com 2 tarefas e 3 recorrentes mostra "2 tarefas" no
  header e a linha "+3 rotinas".
- Frontend: `onDragEnd` de um dia para outro chama `onTaskUpdate` com o
  `due_date` do dia de destino.
- Backend: se mudar a chave do grupo para ISO, ajustar os testes de
  `operations/list.js` que assertam nomes de grupo.

## 9. Lint
```bash
cd frontend && npx eslint --fix components/Task/GroupedTaskList.tsx components/Tasks.tsx
cd backend && npx eslint --fix modules/tasks/operations/list.js
```

## Critério de pronto
- [ ] Sem scroll horizontal em nenhuma largura.
- [ ] Nenhum título truncado no layout empilhado.
- [ ] Header do dia mostra contagem de trabalho real + tempo somado.
- [ ] Rotinas colapsadas em uma linha por dia, expansível.
- [ ] Arrastar entre dias grava `due_date` e sobrevive a reload.
- [ ] Chave de grupo é dado (ISO), rótulo é tradução.
- [ ] Suítes + tsc + **webpack build** verdes.

## Commit
`feat(upcoming): stack days, collapse routines, drag to reschedule` —
"Implements plans/77".

## Fora de escopo
- Reprogramar instância recorrente por drag.
- "Próximos projetos" no rodapé (fica como está nesta rodada).
- Visão de mês/calendário — é o plano 60.
