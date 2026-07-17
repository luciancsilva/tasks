---
name: tududi-mcp
description: Guia de uso correto do MCP server do tududi (fork do Lucian) — 44 tools de tasks, projects, areas, habits, inbox, notes, tags e search. Use sempre que for ler ou alterar dados do tududi via MCP; cobre parâmetros reais, mapeamentos de status/prioridade, identificadores aceitos por cada tool e as armadilhas que a doc oficial não conta.
---

# tududi MCP — uso correto sem tentativa e erro

Fonte da verdade: `backend/modules/mcp/` do fork (a doc
`docs/14-mcp-integration.md` descreve só 16 das 44 tools). Toda operação é
isolada ao usuário do token; não há como tocar dados de outro usuário.

## Regras de ouro (leia antes de qualquer chamada)

1. **`delete_task` usa o caminho seguro do backend** (`tasksService.delete`):
   anexos e recorrência são tratados, sem órfãos no R2. Ainda assim, deleção é
   permanente — **confirme deletes com o dono** antes de chamar.
2. **`complete_task` é um TOGGLE.** Em tarefa concluída, ele REABRE. Confira o
   status via `get_task` antes; nunca repita a chamada "para garantir".
3. **`list_tasks {type}` filtra por data de verdade** (timezone do usuário):
   - `today` = `due_date` ≤ fim de hoje **OU** status ∈
     {in_progress, waiting, planned}, sempre excluindo done/archived/cancelled;
     ordenado por `due_date`.
   - `upcoming` = `due_date` nos próximos 7 dias, mesmas exclusões.
   - `completed` = status done; `archived` = status archived; `all` = sem filtro.
4. **Enum de status** (em `list_tasks` e `update_task`):
   `not_started|pending|in_progress|done|completed|waiting|planned|archived|cancelled`
   — `pending` é alias de not_started, `completed` de done. Mapa numérico real:
   0=not_started, 1=in_progress, 2=done, 3=archived, 4=waiting, 5=cancelled,
   6=planned. `waiting` e `archived` são acessíveis via MCP.
5. **Deleções são permanentes e sem confirmação.** `delete_project` apaga o
   projeto E todas as tarefas (notas são desanexadas, não apagadas).
   `delete_area` NÃO apaga projetos (só desvincula). `delete_tag` remove a tag
   de tudo. `delete_habit` leva o histórico junto. Peça confirmação humana
   antes de qualquer delete.

## Identificadores — qual tool aceita o quê

| Entidade | Aceita |
|---|---|
| Task | `id` numérico OU `uid` string (ambos no parâmetro `id`) |
| Project, Area, Habit, Note, Inbox item | somente `uid` (string) |
| Tag | `uid` OU nome |

Sempre que uma listagem devolver `uid`, guarde e use o `uid` — é estável.

## Mapeamentos que divergem entre entidades

- **Prioridade de TASK**: string `low|medium|high` (default `medium`).
- **Prioridade de PROJECT**: número `0|1|2` (0=low, 1=medium, 2=high).
- **Status de TASK**: ver regra de ouro 4.
- **Status de PROJECT**: string `not_started|planned|in_progress|waiting|done|cancelled`.
- **Datas**: ISO 8601. `description` de task vira o campo `note` interno.

## As 44 tools por categoria

### Tasks (8)
- `list_tasks {type?, status?, project_id?, limit=50}` — regras 3 e 4.
- `get_task {id}` — detalhes com projeto, tags, subtasks.
- `create_task {name, description?, priority?, due_date?, project_id?, tags?[]}` —
  tags são criadas se não existirem. NÃO aceita `today` nem status inicial.
- `update_task {id, name?, description?, priority?, status?, due_date?, project_id?, today?}` —
  `project_id: null` desvincula; `today: true` põe na lista de hoje.
- `complete_task {id}` — TOGGLE (regra 2).
- `delete_task {id}` — regra 1.
- `add_subtask {parent_id, name, priority?, due_date?}` — herda o projeto do pai.
- `get_task_metrics {}` — abertas, concluídas, vencidas, hoje, semana.

### Projects (5)
- `list_projects {status?, area_id?, limit=30}` — sem `status`, TODOS os
  status vêm juntos (inclusive done/cancelled); `"all"` idem explícito.
- `get_project {uid}`
- `create_project {name, description?, priority?(número), status?, area_id?, due_date_at?, tags?[]}`
- `update_project {uid, name?, description?, priority?, status?, area_id?, pinned?}` —
  `pinned` fixa na sidebar.
- `delete_project {uid}` — cascata de tarefas (regra 5); caminho seguro do
  backend (R2 limpo).

### Areas (5)
- `list_areas {}` · `get_area {uid}` · `create_area {name, description?, color?}`
- `update_area {uid, name?, description?, color?}` — `color: ""` remove a cor.
- `delete_area {uid}` — projetos ficam órfãos, não são apagados.

### Habits (9) — hábito é uma task com `habit_mode`
- `list_habits {}` · `get_habit {uid}`
- `create_habit {name, note?, priority?, habit_target_count?, habit_frequency_period?(daily|weekly|monthly), habit_streak_mode?(calendar|scheduled), habit_flexibility_mode?(flexible|strict)}`
- `update_habit {uid, ...mesmos campos}`
- `delete_habit {uid}` — permanente, leva o histórico (regra 5).
- `log_habit_completion {uid, completed_at?}` — default agora; retorna
  streaks. NÃO é toggle: cada chamada loga uma completion nova. Não repita.
- `get_habit_completions {uid, start_date?, end_date?}` — default 30 dias.
- `delete_habit_completion {uid, completion_id}` — recalcula streaks.
- `get_habit_stats {uid, start_date?, end_date?}`

### Inbox (6) — captura GTD
- `list_inbox {limit=20, offset=0}` · `get_inbox_item {uid}`
- `add_to_inbox {content, source?="mcp"}` — captura rápida; NÃO cria task.
- `update_inbox_item {uid, content?, status?}` — status: `added|processed|deleted`.
- `process_inbox_item {uid}` — marca processado. Triagem correta: criar a
  task/nota correspondente PRIMEIRO, processar o item DEPOIS.
- `delete_inbox_item {uid}`

### Notes (5)
- `list_notes {tag?, order_by?="title:asc"}` — order_by `coluna:direção`.
- `get_note {uid}` · `delete_note {uid}`
- `create_note {title, content?, project_uid?, color?, tags?[]}` — markdown ok.
- `update_note {uid, title?, content?, project_uid?, color?, tags?[]}` —
  `project_uid: ""` desanexa; **`tags` SUBSTITUI as existentes**.

### Tags (5)
- `list_tags {}` · `get_tag {uid? | name?}` (um dos dois)
- `create_tag {name}` · `update_tag {uid(ou nome), name}` · `delete_tag {uid(ou nome)}`

### Misc (1)
- `search {query, type?=all(task|project|note), limit?=10}` — substring
  (LIKE `%q%`) em nome/nota/título/conteúdo. Não é fuzzy: sem resultado,
  tente um termo mais curto antes de concluir que não existe.

## Receitas prontas

**Capturar algo dito pelo usuário** (não classifique você mesmo):
`add_to_inbox {content: "..."}` — a triagem é do dono no app.

**Criar tarefa num projeto citado por nome**:
1. `list_projects {}` → ache o projeto, guarde o `id` numérico.
2. `create_task {name, project_id: <id numérico>}` (create usa `id`, não `uid`).

**Triagem de inbox** (quando o dono pedir):
1. `list_inbox {}` → decidir item a item com o dono.
2. Virou task: `create_task {...}`; virou nota: `create_note {...}`.
3. Só então `process_inbox_item {uid}`.

**"O que tenho para hoje?"**:
`list_tasks {type: 'today'}` — já devolve `due_date` ≤ hoje mais
in_progress/waiting/planned, excluindo concluídas/arquivadas/canceladas.
Vencidas isoladas: `list_tasks {type: 'today'}` e filtrar `due_date` < hoje.

**Concluir tarefa com segurança**:
`get_task {id}` → se status ≠ done/2, `complete_task {id}`.

**Registrar hábito de hoje**:
`get_habit_completions {uid}` → se já houver completion hoje, NÃO logue de
novo; senão `log_habit_completion {uid}`.

## Erros comuns e significado

- `"Task not found: X"` — id/uid errado OU entidade de outro tipo (ex.: uid de
  projeto passado a `get_task`).
- `"Habit not found: X"` — uid existe mas a task não tem `habit_mode`: use as
  tools de task.
- `"MCP feature is not enabled"` — servidor sem `FF_ENABLE_MCP=true`.
- `"Invalid or expired API token"` — regenerar em Profile → API Keys.
- Listagem vazia — não é erro; filtro restritivo demais. Relaxe os parâmetros
  antes de concluir que não há dados.
