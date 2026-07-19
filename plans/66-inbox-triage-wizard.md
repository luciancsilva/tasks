# 66 — Inbox triage wizard (inline 5 botões: Ação/Projeto/Ref/Someday/Lixo)

> **Status: EXECUTADO** em 2026-07-19 — footer com 6 botões GTD (Ação/2-min/Projeto/Referência/Someday/Lixo); `buildTaskForConversion(context, overrides)` extraído; 2-min cria task `status:'done'` (1 clique), Someday cria `is_someday:true`; ambos via `openTaskModal` (que já é create-direto no parent, não modal). **Desvios:** (1) backend não setava `completed_at` no create com status done (`buildTaskAttributes`/create nunca chamavam `handleCompletionStatus`) — corrigido em `tasks/service.js` create, senão o 2-min ficaria done sem timestamp e sumiria de "Completed today"; (2) **bug de crash pré-existente** — `InboxItemDetail` destruturava `peopleStore` de `useStore()`, slice que nunca existiu no store (desde plano 26), crashando o componente no mount; corrigido passando `people` como prop do `InboxItems`. Afeta planos executados 26/27/33/34/65/68 (não reabrir). Plano assumia `analyzeText`/`createTask` diretos — realidade é parsing client-side + `openTaskModal`.
> **Status original: PROPOSTO** — InboxCard tem 3 botões convert (Task/Note/Project) sem prompt GTD (`InboxItemDetail.tsx:645-706`). Decisão aprovada: inline 5 botões + subtipo "2-min" em Ação.
> **Esforço:** Médio · **Natureza:** julgamento baixo · **Modelo:** médio
> **Branch:** `feat/66-inbox-triage` a partir da `main` · **Depende de:** 49 (is_someday)

## Contexto

Refs:
- `InboxItemDetail.tsx` `renderComposerFooter` `:645-706` — 3 botões (Task `:650-663` `handleConvertToTask` `:465-529`, Note `:664-677` `handleConvertToNote` `:574-643`, Project `:678-691` `handleConvertToProject` `:547-572`, Delete `:694-702` `handleDelete` `:708`).
- `handleConvertToTask` cria task via `tasksService.create` + marca inbox item processed.
- `inboxProcessingService.js` `processInboxItem` `:475-500` — parsing tokens.

5 botões GTD: **Ação** (→ task not_started), **Ação 2-min** (→ task criada + completada em 1 clique), **Projeto** (→ project + primeira task), **Referência** (→ note), **Someday** (→ task `is_someday=true`), **Lixo** (→ delete). "Ação 2-min" honra regra GTD: se leva <2min, faça já.

## 1. Baseline
```bash
npm run backend:test && npm run frontend:test
```

## 2. Frontend — substituir footer
`frontend/components/Inbox/InboxItemDetail.tsx` `renderComposerFooter` (`:645-706`): substituir 3 botões por 5 (+ subtipo):

```tsx
<div className="flex flex-wrap items-center gap-2">
    {/* Ação */}
    <button onClick={handleConvertToTask} className="px-3 py-1.5 text-sm rounded bg-blue-600 text-white hover:bg-blue-700">
        {t('inbox.triageAction', 'Action')}
    </button>
    {/* Ação 2-min */}
    <button onClick={handleConvertToTaskTwoMin} className="px-3 py-1.5 text-sm rounded bg-green-600 text-white hover:bg-green-700">
        {t('inbox.triageTwoMin', '2-min action')}
    </button>
    {/* Projeto */}
    <button onClick={handleConvertToProject} className="px-3 py-1.5 text-sm rounded bg-purple-600 text-white hover:bg-purple-700">
        {t('inbox.triageProject', 'Project')}
    </button>
    {/* Referência */}
    <button onClick={handleConvertToNote} className="px-3 py-1.5 text-sm rounded bg-yellow-600 text-white hover:bg-yellow-700">
        {t('inbox.triageReference', 'Reference')}
    </button>
    {/* Someday */}
    <button onClick={handleConvertToSomeday} className="px-3 py-1.5 text-sm rounded bg-gray-500 text-white hover:bg-gray-600">
        {t('inbox.triageSomeday', 'Someday')}
    </button>
    {/* Lixo */}
    <button onClick={handleDelete} className="px-3 py-1.5 text-sm rounded bg-red-600 text-white hover:bg-red-700">
        {t('inbox.triageTrash', 'Trash')}
    </button>
</div>
```

## 3. Frontend — handlers

### 3a. `handleConvertToTaskTwoMin`
```tsx
const handleConvertToTaskTwoMin = async () => {
    if (!item) return;
    const parsed = processInboxItem(item.content); // reusa parser
    const taskPayload = {
        name: parsed.cleaned_content || item.content,
        tags: parsed.parsed_tags,
        project_uid: parsed.parsed_projects[0], // se houver
        status: 'done', // 2-min rule: faça já
        completed_at: new Date().toISOString(),
    };
    await createTask(taskPayload);
    await processInboxItem(item.uid); // marca processed
    onItemProcessed(item.uid);
};
```
`processInboxItem` do `inboxProcessingService` é server-side (POST /inbox/analyze-text) ou importar parser client-side? Parser é backend (`inboxProcessingService.js`). Frontend chama `POST /inbox/analyze-text` com content para obter parsed, OU reusa parsed se já disponível no item (`parsed_tags`/`cleaned_content` — mas `inbox/service.js:create` NÃO persiste parsed). Solução: chamar `POST /inbox/analyze-text` antes de criar task, OU repassar content bruto + `#tag`/`+project` para `createTask` (tasksService.create já aceita `tags` array + `project_uid`; parsing de tokens no backend do tasks? Não — tasks create não parseia `#tag` no name). Decisão: chamar `analyzeText(content)` (`inboxService.ts`) para obter parsed, depois `createTask` com payload estruturado.

### 3b. `handleConvertToSomeday`
```tsx
const handleConvertToSomeday = async () => {
    const parsed = await analyzeText(item.content);
    await createTask({
        name: parsed.cleaned_content || item.content,
        tags: parsed.parsed_tags,
        project_uid: parsed.parsed_projects[0],
        is_someday: true, // plano 49
    });
    await processInboxItem(item.uid);
    onItemProcessed(item.uid);
};
```

### 3c. `handleConvertToTask` (existente `:465-529`)
Manter, mas garantir que repassa `parsed_tags`/`parsed_projects` do `analyzeText` para o `createTask` payload (se já não faz).

## 4. Frontend — inboxService
`frontend/utils/inboxService.ts`: confirmar `analyzeText(content)` existe (chama `POST /inbox/analyze-text`). Se não, adicionar:
```ts
export async function analyzeText(content: string) {
    const res = await fetch('/api/inbox/analyze-text', { method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content }) });
    return res.json();
}
```

## 5. i18n
Chaves `inbox.triageAction`, `inbox.triageTwoMin`, `inbox.triageProject`, `inbox.triageReference`, `inbox.triageSomeday`, `inbox.triageTrash` em PT/EN.

## 6. Testes — frontend
`frontend/__tests__/`:
- `InboxItemDetail` renderiza 6 botões (Action/2-min/Project/Reference/Someday/Trash).
- Click "2-min action" cria task com `status: 'done'` + marca inbox processed.
- Click "Someday" cria task com `is_someday: true` + marca processed.
- Click "Trash" deleta item.

## 7. Lint
```bash
cd frontend && npx eslint --fix components/Inbox/InboxItemDetail.tsx utils/inboxService.ts
```

## Critério de pronto
- [ ] InboxItemDetail footer tem 6 botões GTD (Action/2-min/Project/Reference/Someday/Trash).
- [ ] "2-min action" cria task done + marca inbox processed.
- [ ] "Someday" cria task `is_someday=true` + marca processed.
- [ ] Tokens (`#tag`/`+project`) parseados via `analyzeText` e repassados ao createTask.
- [ ] Suítes verde; lint limpo.

## Commit
`feat(inbox): GTD triage with 5 inline buttons and 2-min rule` — "Implements plans/66". Branch `feat/66-inbox-triage`, sem merge/push.

## Fora de escopo
- Wizard sequencial (não aprovado).
- AI auto-suggest triage (não aprovado).
- Bulk triage (plano 69).
