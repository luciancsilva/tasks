# Setup GTD no tududi — migrando do TickTick

Guia para replicar um fluxo GTD (Getting Things Done) que hoje vive no TickTick
usando o tududi **por convenção + Views**, sem feature nova. A decisão de
checkpoint (2026-07-17) foi: o tududi já tem as peças (Areas, Projects, People,
Tags, Habits, status `waiting`, `assigned_to` e Views fixáveis) — o que falta é
o mapeamento. Este documento é esse mapeamento.

Pré-requisito: as Views por status de tarefa e por pessoa (plano 16). Se a sua
instância ainda não tem os filtros de `task_status`/`assigned_to` no "Save as
Smart View", atualize antes.

---

## Seção 1 — Mapeamento TickTick → tududi

| TickTick | tududi |
|---|---|
| Grupos 💼 Trabalho / 👤 Pessoal | **Areas** (`/areas`) |
| Lista 🚀 Projetos | **Projects** (`/projects`), dentro da Area |
| Lista ⚡ Ações | tarefas `not_started`/`in_progress`, soltas ou num projeto |
| Lista ⏰ Aguardando | tarefas com status **waiting** + **View fixada** |
| Lista 📌 Delegadas | tarefas com **assigned_to** (People) + **View por pessoa** |
| Lista 🎯 Algum dia / Talvez | tag `algum-dia` + **View fixada** |
| Tags hierárquicas de contexto | tags planas com prefixo (ver abaixo) |
| Hábitos de revisão | **Habits** (`/habits`) — mesmos 3, mesmos horários |

O tududi não tem tags hierárquicas. Achate a hierarquia com prefixo:

| Contexto | Tags planas |
|---|---|
| Duração | `d-rapido`, `d-medio`, `d-demorado` |
| Energia | `e-alta`, `e-media`, `e-baixa` |
| Origem | `origem-outlook` |
| Pessoa | uma tag por delegado, ou use `assigned_to` (People) — ver Seção 2 |

Preferir `assigned_to` (People) a tags de pessoa: é o campo que a View
"Delegadas" filtra, e mantém o cadastro da pessoa (nome, relação) num lugar só.

---

## Seção 2 — Passo a passo de configuração

Tudo pela UI. Ordem sugerida:

### 1. Criar as 2 Areas
`/areas` → nova Area → **Trabalho** e **Pessoal**.

### 2. Cadastrar as pessoas em People
`/people` → nova pessoa. Cadastre os delegados reais:
`daniel`, `everson`, `gisele`, `joão`, `karolina`, `paulo`, `rh`, `ti`,
`auditoria`, `contabilidade`. Cada pessoa ganha um `uid` estável — é o que a
View "Delegadas" usa.

### 3. Criar as tags de contexto
`/tags` → criar as tags planas da Seção 1 (`d-rapido`, `e-alta`,
`origem-outlook`, `algum-dia`, …). Tags também nascem sozinhas ao digitar
`#tag` numa tarefa, mas criá-las antes deixa a cor/consistência sob controle.

### 4. Criar e fixar as Views
As Views são "smart searches" salvas. Fluxo: faça a busca/filtro na busca
universal, clique **Save as Smart View**, e no modal escolha os filtros novos
(**Task status** e **Assigned to**). Depois abra a View (`/views`) e clique na
**estrela** para fixá-la na sidebar.

Crie e fixe:
- **⏰ Aguardando** — filtro **Task status = Waiting**.
- **📌 Delegadas** — filtro **Assigned to = <pessoa>**. Crie uma por delegado de
  maior volume, ou uma geral por pessoa conforme a necessidade.
- **🎯 Algum dia** — filtro por tag `algum-dia`.

### 5. Criar os 3 hábitos de revisão
`/habits` → novo hábito, com recorrência e lembrete:
- **Processar caixa de entrada** — seg-sex, 9h.
- **Acompanhar tarefas delegadas** — sexta, 8h30.
- **Encerrar a semana** — sexta, 16h.

---

## Seção 3 — Ritmo de revisão

- **Diário (seg-sex, 9h)** — processar a Inbox (`/inbox`) até zerar: cada item
  vira task, nota ou lixo. Regras de captura/triagem em
  [04-inbox-page.md](04-inbox-page.md).
- **Sexta 8h30** — abrir a View **Delegadas**, cobrar/atualizar cada item.
- **Sexta 16h ("Encerrar a semana")**:
  - Today (`/today`) e Overdue limpos;
  - View **Aguardando** revisada;
  - projetos **stalled** ([06-projects.md](06-projects.md)) reativados ou
    despachados para `algum-dia`;
  - Views de **Algum dia** varridas por promoções (o que virou ação da semana).

---

## Seção 4 — Captura

Três caminhos, todos caindo na mesma Inbox:

- **UI** — página Inbox (`/inbox`); atalhos e parsing em
  [04-inbox-page.md](04-inbox-page.md).
- **Telegram** — bot já integrado; manda a mensagem, cai na Inbox.
- **Agentes de IA** — `add_to_inbox` via MCP. A triagem continua sendo sua no
  app; o agente só captura. Uso correto do MCP em
  [`skills/tududi-mcp/SKILL.md`](../skills/tududi-mcp/SKILL.md).

---

> Este guia mapeia convenção, não código. Se as Views de status/pessoa forem
> descartadas (plano 16), as seções de "Aguardando"/"Delegadas" caem junto.
