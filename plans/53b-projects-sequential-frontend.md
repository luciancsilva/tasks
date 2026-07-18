# 53b — Projects sequential vs parallel (frontend)

> **Status: PROPOSTO** — UI do `execution_mode` (plano 53a faz backend). Toggle no ProjectModal + indicador visual no ProjectDetails + destaque de "next action" na lista de tasks do projeto.
> **Esforço:** Médio · **Natureza:** julgamento baixo · **Modelo:** médio
> **Branch:** `feat/53-projects-sequential` · **Depende de:** 53a

## Contexto

Backend (53a) já filtra tasks de projetos sequential nas listas de ação. Frontend precisa: (1) usuário marcar projeto como sequential; (2) dentro do projeto, destacar qual é a "next action"; (3) Today/Next já recebem backend filtrado — só mostrar badge "next" na task visível.

## 1. Baseline
```bash
npm run backend:test && npm run frontend:test
```
Confirmar 53a na branch.

## 2. Entity TS
`frontend/entities/Project.ts`: adicione `execution_mode?: 'parallel' | 'sequential'`.
`frontend/entities/Task.ts`: adicione `is_project_next_action?: boolean` (se 53a_serializer computa; senão, frontend computa).

## 3. ProjectModal — `frontend/components/Project/ProjectModal.tsx`

### 3a. Form state
`formData` default (`:49-60`): adicione `execution_mode: 'parallel'`. Reset (`:154`): adicione `execution_mode: 'parallel'`.

### 3b. Seção expansível
`expandedSections` (`:81-85`): adicione `executionMode: false`. Toggle handler existente (`toggleSection`).

### 3c. UI da seção
Espelhe a seção `status` (`:558-591`). Renderize (dentro do bloco `expandedSections.executionMode && (...)`):
```tsx
<div className="mb-4">
    <label className="block text-sm font-medium mb-2">{t('projects.executionMode', 'Execution mode')}</label>
    <div className="flex gap-2">
        <button
            type="button"
            onClick={() => setFormData(prev => ({ ...prev, execution_mode: 'parallel' }))}
            className={`px-3 py-2 rounded ${formData.execution_mode === 'parallel' ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-700'}`}
        >
            {t('projects.executionModeParallel', 'Parallel')}
        </button>
        <button
            type="button"
            onClick={() => setFormData(prev => ({ ...prev, execution_mode: 'sequential' }))}
            className={`px-3 py-2 rounded ${formData.execution_mode === 'sequential' ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-700'}`}
        >
            {t('projects.executionModeSequential', 'Sequential')}
        </button>
    </div>
    <p className="text-xs text-gray-500 mt-1">
        {t('projects.executionModeHelp', 'Sequential: only the next action shows in Today/Next. Completing it reveals the next.')}
    </p>
</div>
```

### 3d. Submit
`handleSubmit` (`:368-381`): incluir `execution_mode` no payload se mudou (`formData.execution_mode !== project.execution_mode`).

### 3e. Botão de header da seção
Espelhe o botão de `status` (`:742-755`): toggle `expandedSections.executionMode`, label `t('projects.executionMode', 'Execution mode')`, mostra valor atual.

## 4. ProjectDetails — `frontend/components/Project/ProjectDetails.tsx`

### 4a. Badge no header
Próximo ao status badge, adicione:
```tsx
{project.execution_mode === 'sequential' && (
    <span className="px-2 py-1 text-xs rounded bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-200">
        {t('projects.sequential', 'Sequential')}
    </span>
)}
```

### 4b. ProjectTasksSection — destacar next action
Em `frontend/components/Project/ProjectTasksSection.tsx` (ou onde tasks do projeto são renderizadas): se `project.execution_mode === 'sequential'`, ordenar tasks por `order` ASC (null last) e destacar primeira não-done com badge "Next action":
```tsx
const sortedTasks = [...tasks].sort((a, b) => {
    if (a.order == null && b.order == null) return 0;
    if (a.order == null) return 1;
    if (b.order == null) return -1;
    return a.order - b.order;
});
const nextActionTask = sortedTasks.find(t => t.status !== 2 && t.status !== 3 && t.status !== 5);
// ao renderizar cada task:
{task.uid === nextActionTask?.uid && (
    <span className="px-2 py-0.5 text-xs rounded bg-green-100 text-green-700">{t('projects.nextAction', 'Next action')}</span>
)}
```

### 4c. Reorder mínimo (sequential)
Para sequential funcionar, user precisa poder setar `order`. Sem drag (plano 64 cobre drag geral), expor input numérico de `order` por task OU setas up/down. Simplificação: ao criar/editar task dentro de projeto sequential, auto-atribuir `order = max(order)+1`. Para reorder, botões up/down que fazem swap de `order` entre tasks adjacentes via PATCH. (Se drag do plano 64 já estiver implementado, pular esta parte.)

## 5. Tasks list (Today/Next/Upcoming)
`TasksToday.tsx`, `Tasks.tsx`: backend já oculta non-next. Frontend mostra badge "Next" se task tem `is_project_next_action=true` (se 53a_serializer computa) OU se frontend detecta (não recomendado — duplica lógica). Preferir usar campo do backend. Sem filtragem client-side.

## 6. i18n
Chaves em `frontend/i18n/locales/*/projects.json` (PT-BR + EN no mínimo):
```json
{
  "executionMode": "Modo de execução",
  "executionModeParallel": "Paralelo",
  "executionModeSequential": "Sequencial",
  "executionModeHelp": "Sequencial: apenas a próxima ação aparece em Today/Next. Completá-la revela a seguinte.",
  "sequential": "Sequencial",
  "nextAction": "Próxima ação"
}
```

## 7. Testes — frontend
`frontend/__tests__/`:
- `ProjectModal` renderiza toggle; mudar para sequential envia payload com `execution_mode: 'sequential'`.
- `ProjectDetails` em projeto sequential mostra badge "Next action" na primeira task não-done.

## 8. Lint
```bash
cd frontend && npx eslint --fix components/Project/ProjectModal.tsx components/Project/ProjectDetails.tsx components/Project/ProjectTasksSection.tsx components/Task/TasksToday.tsx components/Task/Tasks.tsx entities/Project.ts entities/Task.ts
```

## Critério de pronto
- [ ] ProjectModal tem toggle Parallel/Sequential; persiste.
- [ ] ProjectDetails mostra badge do modo + "Next action" na primeira task não-done (sequential).
- [ ] Tasks em listas globais mostram badge "Next" quando aplicável.
- [ ] Entities tipadas; i18n PT/EN.
- [ ] Suítes verde; lint limpo.

## Commit
`feat(projects): sequential mode UI in ProjectModal and ProjectDetails` — "Implements plans/53b". Branch `feat/53-projects-sequential`.

## Fora de escopo
- Drag reorder de tasks dentro do projeto (plano 64).
- Visual de "encadeamento" (linhas conectando tasks sequenciais).
