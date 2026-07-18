# 30 — templates ("Modelos"): robustez de erro + diagnóstico

> **Status: PROPOSTO** — a página Modelos mostra "Falha ao carregar/criar os modelos". O código está completo e correto no repo; a falha bate com backend velho não reiniciado após o commit dos templates. Melhorar a superfície de erro e diagnosticar o ambiente.
> **Esforço:** Baixo (código) · **Natureza:** misto — robustez mecânica + **diagnóstico de ambiente exige humano** · **Modelo:** médio p/ código; **passo de diagnóstico é humano**.
> **Branch:** `main` · **Depende de:** -

## Diagnóstico

Código **completo e correto** (feature do plano 23, commits `342280d9` /
`5df65492`):
- Rota registrada: `backend/app.js:407` (`app.use(basePath, templatesModule.routes)`),
  require `app.js:317`.
- Router `backend/modules/templates/routes.js`: `GET /templates` (32-45),
  `POST /template` (67-80), gated por `requireTemplatesEnabled` (17-25).
- Service `backend/modules/templates/service.js` usa a tabela `projects` com
  `is_template=true` (getAll 76-89, create 113-145) — **não há tabela separada**.
- Migration `20260714000001-add-template-fields-to-projects.js` **aplicada**;
  colunas `is_template/template_category/clone_count/source_template_id` existem.
- Flag `templatesEnabled` default **true** (`backend/config/config.js:232`).
- Verificado read-only: `getAll(user 1)` retorna `{templates:[]}` sem erro.

**Causa provável:** processo backend antigo (anterior ao commit dos templates)
não reiniciado — o Docker builda a `main` do GitHub; um processo velho devolve
404 em `/api/templates` (SPA fallback JSON 404 p/ paths `/api/`, `app.js:419-434`).
Alternativas: `PROJECT_TEMPLATES_ENABLED='false'` no runtime, ou DB de runtime
diferente do `db/development.sqlite3` e não migrado.

O erro real fica escondido: `frontend/utils/templatesService.ts` (`fetchTemplates`
11-19, `createTemplate` 30-46) faz `response.json()` cego; `Templates.tsx`
(`loadTemplates` 140-152, `handleCreate` 154-165) engole no toast genérico PT.

## Implementação Proposta

**Parte A — robustez (código, mecânico):**
- `templatesService.ts`: checar `response.ok`/status antes de `.json()` e
  propagar erro distinguível (404 vs 500 vs HTML).
- `Templates.tsx`: mensagens específicas — 404 → "recurso indisponível, reinicie o
  servidor"; 500 → erro real. Não engolir no toast genérico.

**Parte B — diagnóstico (humano/ambiente, pré-passo):**
- Antes de concluir, `curl`/DevTools em `GET /api/templates` no ambiente que
  falha e classificar (404 vs 500 vs HTML). Registrar no commit/resumo.
- Se 404 por processo velho → rebuild/restart do container resolve (nenhum fix de
  fluxo além da robustez). Se 500 → vira **plano novo** de bug real (não ampliar
  escopo aqui).

## Critério de Pronto

- `npm run frontend:test`.
- Teste: service propaga erro em `!response.ok`; handler mostra mensagem
  específica por status.
- Verificação: reiniciar backend e abrir Modelos → lista carrega e criar modelo
  funciona. Registrar o status HTTP observado no diagnóstico.
- Lint dos arquivos tocados.
