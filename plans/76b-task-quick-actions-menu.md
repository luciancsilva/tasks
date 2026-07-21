# 76b — Menu de ação rápida na linha da tarefa (data sem abrir a tarefa)

> **Status: PROPOSTO** em 2026-07-21 — a única das 5 lacunas da Revisão Semanal
> que **não** é resolvida por props já existentes do `TaskList`.
> **Esforço:** Médio · **Natureza:** julgamento (UX) · **Modelo:** médio ·
> **Branch:** `main` · **Depende de:** 76a (a revisão precisa renderizar
> `TaskItem` para ganhar o menu junto).

## Contexto

Hoje mudar a data de vencimento exige abrir a tarefa: `TaskDueDate`
(`frontend/components/Task/TaskDueDate.tsx`) é display puro — recebe
`dueDate: string` e renderiza um badge, sem handler.

A referência que o dono trouxe (Mindwtr) resolve com **menu de contexto por
linha**, com submenus de data:

```
Adicione ao foco de hoje
Data de início...      ▸
Data de vencimento...  ▸
Data de revisão...     ▸
Contextos...           ▸
Converter em referência
Duplicar
Criar projeto a partir da tarefa
Excluir
```

O ganho não é só a revisão semanal: o mesmo menu serve Hoje, Próximos, Todas as
tarefas — qualquer lista que use `TaskItem`.

## Desenho

Um componente `TaskQuickActions` montado dentro de `TaskItem`, aberto por um
botão `⋯` que aparece no hover da linha (e sempre visível no touch).

Escopo v1 — só o que já tem backend pronto, nada de campo novo:

| Ação | Como grava |
|---|---|
| Hoje / Amanhã / Próxima semana / Escolher data… / Limpar | `PATCH /api/task/:uid` com `due_date` |
| Adiar (defer) para… | `defer_until` (já existe no model) |
| Prioridade ▸ baixa/média/alta | `priority` |
| Marcar Algum dia/Talvez | `is_someday` (plano 49) |
| Aguardando desde hoje | `status: waiting` + `waiting_since` (plano 50) |
| Excluir | rota de delete existente |

"Escolher data…" abre o mesmo date input já usado no `TaskForm`, não um
calendário novo.

## Implementação

1. **`frontend/components/Task/TaskQuickActions.tsx`** (novo)
   - Props: `task: Task`, `onUpdate: (t: Task) => Promise<void>`,
     `onDelete: (uid: string) => void`.
   - Popover posicionado, fechando em `Escape`, clique fora e blur.
   - Cada ação monta o patch e delega ao `onUpdate` que a lista já recebe —
     **não** chame o service direto daqui, senão a lista não revalida.
2. **`TaskItem`**: renderizar o botão `⋯` e o popover; nada muda na assinatura
   pública além de um opcional `showQuickActions?: boolean` (default `true`).
3. **Datas relativas**: reuse `frontend/utils/dateUtils.ts`
   (`getTodayDateString`, `getTomorrowDateString`) — não faça aritmética de
   `Date` na mão, e cuidado com fuso: as datas de tarefa são string `YYYY-MM-DD`.
4. **Otimista**: aplique o patch local antes da resposta e reverta no catch,
   como `TaskItem` já faz no toggle de conclusão.

## Cuidados registrados no napkin

- Toda escrita passa por `getPostHeadersWithCsrf()`. Um `fetch` com header
  montado à mão responde 403 fora de teste e a suíte **não** acusa
  (`NODE_ENV=test` desliga o CSRF).
- Rode `npx webpack --config webpack.config.js --mode development` antes de dar
  por pronto: jest e tsc não pegam erro de sintaxe nem dependência faltando.

## i18n
Bloco `quickActions.*` em en **e** pt: `today`, `tomorrow`, `nextWeek`,
`pickDate`, `clearDate`, `defer`, `priority`, `markSomeday`, `markWaiting`,
`delete`. Sem fallback inglês.

## Testes
- Unit do componente: clicar "Amanhã" chama `onUpdate` com
  `due_date === getTomorrowDateString()`.
- Unit: `Escape` fecha o popover sem disparar update.
- Integração backend: nenhuma rota nova — só confirme que `PATCH /api/task/:uid`
  aceita `due_date: null` para limpar.

## Critério de pronto
- [ ] Mudar vencimento de qualquer linha sem abrir a tarefa, em qualquer lista.
- [ ] Popover fecha por `Escape`, clique fora e após a ação.
- [ ] Update otimista com revert em falha.
- [ ] i18n completo em en+pt.
- [ ] Suítes + tsc + webpack build verdes.

## Commit
`feat(tasks): quick actions menu on task rows` — "Implements plans/76b".

## Fora de escopo
- "Data de revisão" por tarefa (campo não existe no model).
- "Converter em referência" (não há entidade de referência neste fork).
- Arrastar entre dias para reprogramar — isso é a proposta da tela Próximos.
