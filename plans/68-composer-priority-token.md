# 68 — Composer syntax: `!priority` token

> **Status: EXECUTADO** em 2026-07-19 — `parsePriority` (`!high`/`!medium`/`!low`, primeiro vence) + `!` no strip de `cleanTextFromTagsAndProjects` + `parsed_priority` em `processInboxItem`/`analyzeText`; conversão inbox→task aplica priority (parse client-side em `InboxItemDetail`).
> **Status original: PROPOSTO** — Inbox parseia `#tag`/`+project`/`@person`/`$area` (`inboxProcessingService.js`). Sem token para priority. Decisão aprovada: só `!priority` (high/medium/low).
> **Esforço:** Baixo · **Natureza:** julgamento baixo · **Modelo:** baixo
> **Branch:** `feat/68-composer-priority-token` a partir da `main` · **Depende de:** -

## Contexto

Refs:
- `inboxProcessingService.js` `tokenizeText` `:72-117` (markers `#`/`+`/`@`/`$`; `!` livre).
- `parseHashtags` `:124-176`, `parseProjectRefs` `:183-239`, `parsePeopleRefs` `:246-296`, `parseAreaRefs` `:303-350` — cada um faz group walk sobre `#`/`+`/`@`/`$`.
- `cleanTextFromTagsAndProjects` `:357-389` — strip tokens (group walk `:365-380`).
- `processInboxItem` `:475-500` — retorna parsed shape; sem priority hoje.
- `inbox/service.js` `create` `:70-82` — NÃO persiste parsed.
- Conversão inbox→task (frontend `handleConvertToTask`) chama `createTask` — payload precisa incluir `priority`.

`!` é free marker. Token: `!high` / `!medium` / `!low`. Aplicar ao converter inbox→task.

## 1. Baseline
```bash
npm run backend:test && npm run frontend:test
```

## 2. `parsePriority` — `backend/modules/inbox/inboxProcessingService.js`
Adicione nova função (espelhe `parseAreaRefs` `:303-350` mas com enum fixo):
```js
const PRIORITY_VALUES = ['high', 'medium', 'low'];

function parsePriority(text) {
    const tokens = tokenizeText(text);
    const matches = [];
    for (const token of tokens) {
        if (token.startsWith('!')) {
            const value = token.slice(1).toLowerCase();
            if (PRIORITY_VALUES.includes(value) && !matches.includes(value)) {
                matches.push(value);
            }
        }
    }
    return matches; // array de strings; primeiro = prioridade (se múltiplos, primeiro vence)
}
```
Exporte `parsePriority`.

## 3. Estender `cleanTextFromTagsAndProjects` (`:357-389`)
Group walk (`:365-380`) checa `#`/`+`/`@`/`$`. Adicione `!` ao set de markers para que `!high` seja stripped do cleaned content:
```js
// L365-380: condição atual verifica startsWith('#')||'+'||'@'||'$'
// adicionar: || token.startsWith('!')
```

## 4. Estender `tokenizeText` (`:72-117`)
`tokenizeText` quote-open list (`:85-89`) tem `+`/`@`/`$` (não `#`). Para `!` não há quote (enum curto), mas o group walk precisa reconhecer `!` como marker. Verificar: `tokenizeText` trata `!` como char normal (não-marker) — então `!high` vira um token separado por espaço, OK. Mas `cleanTextFromTagsAndProjects` precisa que `!high` seja identificado como token-marker. Como `tokenizeText` retorna `!high` como token (se precedido por espaço), o group walk em `cleanTextFromTagsAndProjects` (`:365-380`) verá `token.startsWith('!')` e o stripped. Confirmar: `tokenizeText` splita por espaço fora de quotes (`:98-103`), então `!high` é um token. OK.

## 5. Estender `processInboxItem` (`:475-500`)
Adicione ao return shape:
```js
const priorities = parsePriority(content);
return {
    parsed_tags, parsed_projects, parsed_people, parsed_areas,
    cleaned_content,
    parsed_priority: priorities[0] || null, // primeiro vence
    suggested_type, suggested_reason,
};
```

## 6. Estender `analyzeText` endpoint
`backend/modules/inbox/service.js` `analyzeText` (`:150-153`) chama `processInboxItem` — retorno já inclui `parsed_priority` após passo 5.

## 7. Frontend — aplicar ao converter
`frontend/components/Inbox/InboxItemDetail.tsx` `handleConvertToTask` (`:465-529`): ao chamar `analyzeText(content)` (plano 66), obter `parsed_priority`. Incluir no `createTask` payload:
```tsx
const parsed = await analyzeText(item.content);
await createTask({
    name: parsed.cleaned_content || item.content,
    tags: parsed.parsed_tags,
    project_uid: parsed.parsed_projects[0],
    priority: parsed.parsed_priority, // 'high'|'medium'|'low'|null
});
```
`tasksService.create` aceita `priority` (string → backend converte via `Task.getPriorityValue`).

## 8. Frontend — QuickAddOverlay (plano 62)
Overlay placeholder já menciona `!priority`. Ao capturar para Inbox, o token fica no `content` (InboxItem não parseia ao criar — `inbox/service.js:create` não chama parser). Parsing ocorre na conversão (passo 7). OK — fluxo consistente.

## 9. Testes — backend
`backend/tests/integration/inbox-priority-token.test.js`:
- `analyzeText("Ligar cliente !high +Vendas")` → `parsed_priority: 'high'`, `parsed_projects: ['Vendas']`, `cleaned_content: 'Ligar cliente'`.
- `"Relatório !low"` → `parsed_priority: 'low'`.
- `"Sem priority"` → `parsed_priority: null`.
- `"!invalid"` → `parsed_priority: null` (ignorado).
- Múltiplos: `"!high !low"` → `parsed_priority: 'high'` (primeiro vence).
- `cleanTextFromTagsAndProjects("!high task")` → `'task'` (token stripped).

## 10. Lint
```bash
cd backend && npx eslint --fix modules/inbox/inboxProcessingService.js modules/inbox/service.js
cd frontend && npx eslint --fix components/Inbox/InboxItemDetail.tsx components/Shared/QuickAddOverlay.tsx
```

## Request / Response shapes
**POST /api/inbox/analyze-text**: `{ "content": "Ligar cliente !high +Vendas" }` → `{ ..., "parsed_priority": "high", "parsed_projects": ["Vendas"], "cleaned_content": "Ligar cliente" }`.
**POST /api/task** (após conversão): `{ "name": "Ligar cliente", "priority": "high", "project_uid": "..." }`.

## Critério de pronto
- [ ] `parsePriority` reconhece `!high`/`!medium`/`!low`; primeiro vence se múltiplos.
- [ ] `cleanTextFromTagsAndProjects` stripa `!priority` do cleaned content.
- [ ] `processInboxItem`/`analyzeText` retorna `parsed_priority`.
- [ ] Conversão inbox→task aplica `priority` ao `createTask`.
- [ ] Suítes verde; lint limpo.

## Commit
`feat(inbox): parse !priority token in composer` — "Implements plans/68". Branch `feat/68-composer-priority-token`, sem merge/push.

## Fora de escopo
- `*due`, `~defer`, `=energy`, `:time` tokens (não aprovados).
- Auto-sugerir priority via NLP.
