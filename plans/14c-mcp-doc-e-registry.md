# 14c — Doc do MCP alinhada às 44 tools e `listMcpTools` derivado do registry

> **Prioridade: BAIXA** (doc/consistência; nenhum dado em risco) —
> **Esforço: médio** — **Julgamento: não exige** — **Depende de: 14a e 14b**
> (a doc deve descrever o comportamento pós-fix, não o bugado)

## Contexto

- `docs/14-mcp-integration.md` está na versão 1.0.0 (2026-04-26) e documenta
  **16 tools em 4 arquivos**. O código (`backend/modules/mcp/tools/`) tem
  **44 tools em 8 arquivos** — areas (5), habits (9), notes (5), tags (5),
  inbox ampliada (6), projects ampliado (5), tasks (8), search (1).
- `backend/modules/mcp/controller.js:79-174` (`listMcpTools`) devolve uma lista
  **hardcoded** paralela ao registry — duplicação que já divergiu da doc e vai
  divergir do código na próxima tool adicionada.

## O que fazer

### 1. Baseline
```bash
npm run backend:test
```

### 2. `listMcpTools` derivado do registry

- `backend/modules/mcp/toolRegistry.js` exporta `registerAllTools(server, context, tools)`.
  Criar ali uma função `listToolNames()` que:
  - chama `registerAllTools(null, { userId: null, user: null }, tools)` com um
    array vazio e um server dummy `{ }` (os registers só fazem `tools.push`,
    não usam `server` — conferir e manter assim);
  - devolve `[{ name, description }]` a partir de `tools`.
- `controller.js` `listMcpTools` passa a montar as categorias a partir de
  `listToolNames()`, agrupando pelo prefixo do arquivo de origem **ou**
  simplesmente devolvendo a lista plana `{ count, tools: [...] }` — escolher a
  lista plana (mais simples e não quebra consumidor conhecido: o frontend
  `McpTab.tsx` deve ser conferido; se ele espera categorias, manter o formato
  `{ tools: [{ category, count, tools }] }` derivando a categoria de um mapa
  estático arquivo→categoria dentro do registry).
- Teste unitário existente: `backend/tests/unit/modules/mcp/controller.test.js`
  e `toolRegistry.test.js` — atualizar expectativas; o teste novo deve falhar
  se alguém adicionar tool sem ela aparecer no endpoint (comparar contra o
  length real do registry, não contra um número fixo).

### 3. Reescrever `docs/14-mcp-integration.md`

Manter a estrutura atual (transports, setup por cliente, security,
troubleshooting — está boa), substituindo a seção "Available Tools" por:
- tabela por categoria com **as 44 tools** (nome, parâmetros obrigatórios,
  1 linha de descrição). Fonte: os `inputSchema` de
  `backend/modules/mcp/tools/*.js` — transcrever, não inventar;
- subseção "Armadilhas" documentando: enum de status real
  (pós-14b), `complete_task` é toggle, identificadores por entidade (task:
  id|uid; project/area/habit/note/inbox: uid; tag: uid|nome), prioridade
  string em task vs número em project, `tags` de `update_note` substitui em
  vez de acrescentar, `delete_project` cascateia tarefas / `delete_area` não;
- atualizar o File Structure (8 arquivos de tools) e o Document Version.

A skill `skills/tududi-mcp/SKILL.md` (plano 18) cobre o uso por agente; a doc
cobre a referência humana. Não duplicar receitas — na doc, linkar a skill.

### 4. Validação e lint
```bash
npm run backend:test
cd backend && npx eslint modules/mcp/toolRegistry.js modules/mcp/controller.js tests/unit/modules/mcp/controller.test.js tests/unit/modules/mcp/toolRegistry.test.js
```

## Critério de pronto

- [ ] `GET /api/mcp/tools` reflete o registry (teste compara com o length real).
- [ ] Doc lista as 44 tools com parâmetros transcritos dos schemas.
- [ ] Zero contagem hardcoded de tools fora do registry.
- [ ] Suíte verde + lint limpo.

## Commit

`docs(mcp): document all 44 tools and derive the tools endpoint from the registry`
— corpo citando "Implements plans/14c". Sem push. Mesmo commit: banner
EXECUTADO + tabela do README.
