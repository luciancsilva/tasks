# 27 — inbox: token `$area` no título

> **Status: EXECUTADO** em 2026-07-18 — Adicionado parsing de token `$area` no frontend e backend.

## Objetivo

Parser `$area` na inbox análogo a `@pessoa`: vira chip persistente ao sair da
edição e vincula ao criar. `Task.area_id` existe (`backend/models/task.js:129`) —
vínculo é **single** (uma área por tarefa).

## Diagnóstico

Nenhum tokenizer/cleaner reconhece `$` hoje — só `#`, `+`, `@`. Um `$area1` cai
como texto plano no conteúdo limpo. Pontos a espelhar:

- Composer `frontend/components/Inbox/QuickCaptureInput.tsx`: parsers
  `parseHashtags` 279-323, `parseProjectRefs` 325-373, `parsePeopleRefs` 375-422;
  `tokenizeText` 499-533; `cleanQuickCaptureText` 153-180; helpers
  `tokenizeQuickCaptureText` 114-151.
- Chips `frontend/components/Inbox/InboxSelectedChips.tsx`: `renderProjectChip`
  101-149 (modelo p/ `renderAreaChip`).
- Backend parser `backend/modules/inbox/inboxProcessingService.js`: `analyze`
  retorna `parsed_tags/projects/people` (412-428); rota
  `POST /api/inbox/analyze-text` (`controller.js:117-123`).
- Card de exibição `InboxItemDetail.tsx`: parse/clean/render (junto com o fix de
  `@` do plano 26).

## Implementação Proposta

1. Composer: adicionar branch `$` (regex de token, ex.
   `/\$([\p{L}0-9_-]+)/gu`) em parse/tokenize/clean, análogo a `@`.
2. `InboxSelectedChips.tsx`: `renderAreaChip` modelado em `renderProjectChip`.
3. Backend: `parseAreaRefs` + `parsed_areas` em `inboxProcessingService.analyze`.
4. `InboxItemDetail.tsx`: parse/clean/render de `$` (chip persistente + sai do
   título).
5. Criação: payload envia `area_id` resolvendo por nome. **Área é entidade de
   topo — NÃO auto-criar**: se a área não existir, não vincula (deixa como texto
   ou avisa). Decidir mensagem no design; default = ignora silenciosamente o
   token não resolvido.

## Critério de Pronto

- Baseline backend+frontend.
- Testes: parser (`$area` → token/`parsed_areas`); chip persistente no card;
  criação vinculando `area_id` quando a área existe; token ignorado quando não
  existe.
- Verificação manual: `tarefa @pessoa1 $area1` → chips de ambos → Criar tarefa →
  task com assignee + área corretos.
- Lint dos arquivos tocados.
