# 19j — Null Safety na Renderização de Subtarefas (`TaskItem.tsx` e `tasksService.ts`)

> **Status: EXECUTADO** em 2026-07-17 — fetchSubtasks e loadSubtasks blindados contra respostas nulas/não-array, evitando crash de UI ao renderizar subtarefas.
> **Escopo:** Blindar `fetchSubtasks` em `frontend/utils/tasksService.ts:227` e `loadSubtasks` em `frontend/components/Task/TaskItem.tsx:80` contra respostas nulas, indefinidas ou não-array.
> **Depende de:** -

## Diagnóstico
`TaskItem.tsx:219` faz `const subtasksData = await fetchSubtasks(task.uid); setSubtasks(subtasksData);`. Por sua vez, `fetchSubtasks` (`tasksService.ts:227`) retorna diretamente `await response.json()`.

### Impacto
Se a API retornar `null`, `undefined` ou um objeto JSON malformado/de erro (`{ error: ... }`), o estado `subtasks` recebe esse valor não-array. Na renderização do `SubtasksDisplay` (`TaskItem.tsx:70, 80`), a verificação de `subtasks.length === 0` ou `subtasks.map(...)` dispara uma exceção fatal (`TypeError: Cannot read properties of null (reading 'length')` ou `subtasks.map is not a function`), derrubando toda a árvore de componentes e gerando tela branca.

## Implementação Proposta

1. Em `frontend/utils/tasksService.ts:227`:
   ```typescript
   export const fetchSubtasks = async (taskUid: string): Promise<Task[]> => {
       try {
           const response = await fetch(getApiPath(`tasks/${taskUid}/subtasks`));
           if (!response.ok) return [];
           const data = await response.json();
           return Array.isArray(data) ? data : (Array.isArray(data?.subtasks) ? data.subtasks : []);
       } catch {
           return [];
       }
   };
   ```
2. Em `TaskItem.tsx:219`:
   ```typescript
   const loadSubtasks = async () => {
       const subtasksData = await fetchSubtasks(task.uid);
       if (isMountedRef.current) {
           setSubtasks(Array.isArray(subtasksData) ? subtasksData : []);
       }
   };
   ```

## Critério de Pronto
- `npm run frontend:test` sem quebras.
- Adicionar teste de componente (`TaskItem.test.tsx`) onde `fetchSubtasks` é mockado para retornar `null` e verificar que o componente renderiza sem falhar (`subtasks.length === 0`).
