# 14b — MCP: corrigir enum de status (archived≠6), expor `waiting` e filtrar datas de verdade

> **Prioridade: ALTA** (o MCP seta/filtra o status errado hoje) —
> **Esforço: médio** — **Julgamento: não exige** (a semântica está definida
> abaixo; não invente) — **Depende de: nada** (independente do 14a; tocam o
> mesmo arquivo, executar em sequência se ambos abertos)

## Contexto

O enum real de status de Task (`backend/models/task.js:378-390`,
`Task.getStatusValue`) é:

| valor | nome |
|---|---|
| 0 | not_started |
| 1 | in_progress |
| 2 | done |
| **3** | **archived** |
| **4** | **waiting** |
| 5 | cancelled |
| **6** | **planned** |

O MCP (`backend/modules/mcp/tools/taskTools.js`) usa
`{ pending: 0, in_progress: 1, completed: 2, archived: 6 }` em **dois lugares**
(list: linhas ~92-97; update: ~339-344). Consequências:
- `status=archived` filtra/seta **planned**;
- `type=today/upcoming` (linha ~112, `status != 6`) exclui **planned** e inclui
  **archived**;
- `waiting` (4) — o status central do fluxo GTD ("Aguardando") — não é
  acessível via MCP;
- `type=today/upcoming` não filtra por data nenhuma (só o `!= 6` acima).

## O que fazer

### 1. Baseline
```bash
npm run backend:test
```

### 2. Um mapa único e correto

Criar no topo de `taskTools.js` (substituindo os dois statusMap locais):

```js
// Task.getStatusValue (backend/models/task.js) is the source of truth.
const { Task: TaskModel } = require('../../../models');
const STATUS_NAMES = [
    'not_started',
    'in_progress',
    'done',
    'archived',
    'waiting',
    'cancelled',
    'planned',
];
```

Usar `TaskModel.getStatusValue(name)` para converter nome→número nos handlers.
Aceitar também os aliases legados: `pending` → 0 e `completed` → 2 (mapear
explicitamente antes de chamar `getStatusValue`).

### 3. Atualizar os schemas das tools

- `list_tasks.inputSchema.properties.status.enum` e
  `update_task.inputSchema.properties.status.enum` passam a:
  `['not_started', 'pending', 'in_progress', 'done', 'completed', 'waiting', 'planned', 'archived', 'cancelled']`.
- Nas descriptions, registrar: `pending`=alias de `not_started`,
  `completed`=alias de `done`.

### 4. Semântica de `type` em `list_tasks` (linhas ~106-113)

Substituir o bloco por esta semântica exata (usar `Op` já importado):

- `completed` → `status = 2`
- `archived` → `status = 3`
- `today` → `status NOT IN (2, 3, 5)` **e** (`due_date <= fim de hoje` OU
  `today = true`)
- `upcoming` → `status NOT IN (2, 3, 5)` **e** `due_date` entre agora e
  `+7 dias`
- `all` ou ausente → sem filtro adicional

"Fim de hoje": calcular no timezone do usuário (`context.user.timezone`,
fallback `'UTC'`), da mesma forma que `backend/modules/tasks/service.js` usa o
timezone nos handlers de list — inspecionar `operations/list.js` e reusar
helper existente se houver um exportado; senão, calcular com `Date` puro:
data local do usuário via `new Intl.DateTimeFormat('en-CA', { timeZone: tz })`
para obter `YYYY-MM-DD` e montar os limites do dia a partir disso.

- Ordenação: quando `type` for `today`/`upcoming`, ordenar por
  `[['due_date', 'ASC']]` em vez de `created_at DESC`.

### 5. Teste de integração

Em `backend/tests/integration/mcp/mcp-tools.test.js`:
- `update_task status=waiting` → task fica com status 4; `status=archived` → 3.
- seed com: task vencida ontem (0), task hoje (0), task due +3d (0), task
  planned (6), task archived (3);
  - `list_tasks type=today` retorna as duas primeiras, não retorna +3d nem archived, **retorna a planned se ela tiver due hoje** (criar uma planned com due hoje para cobrir);
  - `list_tasks type=upcoming` retorna a de +3d;
  - `list_tasks status=archived` retorna só a archived.

### 6. Validação e lint
```bash
npm run backend:test
cd backend && npx eslint modules/mcp/tools/taskTools.js tests/integration/mcp/mcp-tools.test.js
```

## Critério de pronto

- [ ] Nenhum `statusMap` local restante com `archived: 6`.
- [ ] `waiting` setável e filtrável via MCP.
- [ ] `today`/`upcoming` seguem a semântica da §4 (com testes provando).
- [ ] Aliases `pending`/`completed` continuam funcionando (retrocompat).
- [ ] Suíte verde + lint limpo.

## Commit

`fix(mcp): correct task status mapping and real date filters in list_tasks`
— corpo citando "Implements plans/14b". Sem push. Mesmo commit: banner
EXECUTADO + tabela do README.

## Fora de escopo

Não mexer no comportamento da rota REST nem em `operations/list.js` — só o MCP.
