# 26 — inbox persiste pessoa e vincula ao criar

> **Status: PROPOSTO** — na inbox, `@pessoa` não vira chip persistente ao sair da edição (fica cru no título) e não é vinculada quando a tarefa é criada ("Não atribuído"). Corrigir o parser do card de exibição e o payload de criação.
> **Esforço:** Médio · **Natureza:** julgamento (contrato de payload, first-wins, auto-create) · **Modelo:** médio/forte.
> **Branch:** `main` · **Depende de:** 25 (que exibe `assigned_to`).

## Decisão de produto

`@pessoa` seta `assigned_to` (single — ver plano 25). Com múltiplos `@`, o
**primeiro vence**; os demais são ignorados na criação (chip continua visível na
edição, mas só o 1º vira assignee). Documentar esse comportamento.

## Diagnóstico (dois parsers divergentes)

Existem duas implementações de parser: a do composer (`QuickCaptureInput.tsx`,
entende `@`) e a do card de exibição (`InboxItemDetail.tsx`, só `#`/`+`).

1. **Persistência (item 3b)** — `frontend/components/Inbox/InboxItemDetail.tsx`
   **não tem** `parsePeopleRefs`; `cleanTextFromTagsAndProjects` (206-227) só tira
   `#`/`+`, **não `@`** → `@fulano` fica cru no título (`previewText` 232-235,
   render 704-709); `renderMetadata` (586-662) não tem branch de pessoa → não vira
   chip fora da edição. (O composer faz certo: `parsePeopleRefs` 375-422,
   `cleanQuickCaptureText` 153-180 inclui `@`.)
2. **Vínculo ao criar (item 10)** — os builders de payload largam `people`:
   `InboxItemDetail.tsx:322-392` (`buildConversionPayload`/`handleConvertToTask` só
   tags+project) e o footer do composer `QuickCaptureInput.tsx:1690-1701`. Só o
   `handleSubmit` auto-sugerido monta `people` (1476-1499).
3. **Backend** — `updateTaskPeople`
   (`backend/modules/tasks/operations/people.js:9-54`) preenche só
   `InvolvedPeople` (m2m via `setInvolvedPeople`), **nunca `assigned_to`** — daí
   "Não atribuído". Create em `backend/modules/tasks/service.js:319-415`;
   `assigned_to` é setado em `backend/modules/tasks/core/builders.js:173-174,267-268`.

## Implementação Proposta

1. `InboxItemDetail.tsx`: adicionar parse/clean/render de `@pessoa` espelhando o
   composer — pessoa vira chip persistente e sai do título ao sair da edição
   (fecha 3b).
2. Payload: os builders de conversão passam a incluir a pessoa. Enviar como
   `assigned_to` (uid; auto-criar Person se novo reusando `createPerson` de
   `frontend/utils/peopleService.ts`). **Decisão de contrato:** validar se
   `POST /api/task` aceita `assigned_to` por uid direto ou por nome — alinhar com
   `builders.js`. Se múltiplas pessoas parseadas, enviar só a primeira.
3. Backend: garantir que `create`/`update` aceitam `assigned_to` a partir do
   payload da inbox e persistem; auto-criar Person quando vier nome novo. **Não**
   alterar o fluxo de `InvolvedPeople` (permanece p/ @menções fora da inbox).

## Critério de Pronto

- Baseline backend+frontend.
- Testes: integração — criar task via payload de inbox com `@fulano` → task com
  `assigned_to` populado e visível (encaixa no 25). Frontend — card fora de
  edição mostra chip de pessoa e título limpo.
- Verificação manual: inbox `teste @fulano` → Criar tarefa → detalhe mostra
  ATRIBUÍDO A = fulano; card idem.
- Lint dos arquivos tocados.
