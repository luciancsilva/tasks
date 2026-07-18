# 33 — inbox: converter item salvo perde o `$area`

> **Status: EXECUTADO** em 2026-07-18 — `buildConversionPayload` passou a parsear `areaRefsList` e o builder resolve `area_uid` por match existente (guard `Array.isArray`, sem auto-criar área), setando no `newTask`. Fix delegado ao cavecrew-builder, verificado e testado (frontend 112 verde).
> **Esforço:** Baixo · **Natureza:** mecânico (espelhar o composer) · **Modelo:** fraco (haiku/cavecrew-builder).
> **Branch:** `main` · **Depende de:** -

## Diagnóstico

Mesma divergência de dois parsers do bug original: o composer
`frontend/components/Inbox/QuickCaptureInput.tsx` resolve e envia
`area_uid` no `newTask` (resolve por nome contra `areas`, linhas ~1587-1590 e
~1792-1804). Já o `frontend/components/Inbox/InboxItemDetail.tsx`:
- parseia `$area` (`parseAreaRefs`) e **renderiza** o chip (linhas ~752-788),
- mas o payload de conversão só seta `assigned_to: assignedToUid` (linha ~217) e
  **nenhum campo de área** — `area_uid` nunca entra no `newTask`.

Resultado: `tarefa $trabalho` salva na inbox → Criar tarefa → chip "trabalho"
aparece, tarefa nasce sem área.

## Implementação Proposta

No `InboxItemDetail.tsx`, no builder do payload de conversão (onde já resolve a
pessoa em `assigned_to`), resolver `area_uid` espelhando o composer:
```ts
let areaUid: string | undefined;
if (areaRefs.length > 0) {
    const match = Array.isArray(areas)
        ? areas.find(a => a.name.toLowerCase() === areaRefs[0].toLowerCase())
        : undefined;
    if (match) areaUid = match.uid;
}
// ...adicionar area_uid ao newTask
```
Área é single e **não auto-cria** (é entidade de topo): se não existir, ignora o
token (não vincula). Usar o `areas` já disponível via `areasStore`.

## Critério de Pronto

- `npm run frontend:test`.
- Teste: converter item com `$area` existente → `newTask.area_uid` setado; área
  inexistente → sem vínculo.
- Verificação: inbox `tarefa $trabalho` → Criar tarefa → tarefa com área
  "trabalho".
- Lint do arquivo tocado.
