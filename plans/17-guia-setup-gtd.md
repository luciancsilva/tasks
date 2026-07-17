# 17 — Guia de setup GTD no tududi (documentação, sem código)

> **Status: EXECUTADO** em 2026-07-17 — `docs/17-gtd-setup.md` criado com as 4
> seções (mapeamento TickTick→tududi, passo a passo, ritmo de revisão, captura)
> e registrado no índice do `CLAUDE.md`. Desvios: (1) escrito na branch
> `feat/16-views-gtd`, **não na `main`** — o guia depende das Views de
> status/pessoa do plano 16, que ainda não foi mergeado; decisão do dono, guia e
> feature seguem juntos até o merge. (2) Referências de UI conferidas contra as
> rotas/componentes (`frontend/App.tsx`, `components/{People,Habit,Sidebar}`),
> não por drive de browser ao vivo.

> **Prioridade: BAIXA** — **Esforço: baixo** — **Julgamento: não exige**
> (o conteúdo está especificado abaixo) — **Depende de: 16 JÁ MERGEADO na
> `main` pelo dono** (as views de status/pessoa precisam existir; se o 16 for
> descartado, este plano morre junto) — **Branch: `main` direto** (doc)

## Contexto

O dono migra do TickTick, onde mantém estrutura GTD: listas ⚡Ações,
🚀Projetos, 🎯Algum dia/Talvez, ⏰Aguardando, 📌Delegadas (×2: Trabalho e
Pessoal), tags de contexto (duração: rápido/médio/demorado; energia:
alta/média/baixa; pessoa: 10 delegados; origem: outlook) e 3 hábitos de
revisão ("Processar caixa de entrada" seg-sex 9h, "Acompanhar tarefas
delegadas" sex 8h30, "Encerrar a semana" sex 16h).

Decisão do checkpoint 2026-07-17: **replicar isso no tududi por convenção +
Views, não por feature nova**. Este plano escreve o guia que mapeia cada peça.

## O que fazer

Criar `docs/17-gtd-setup.md` (em PT-BR, seguindo o formato dos docs de
comportamento existentes) com este conteúdo:

### Seção 1 — Mapeamento TickTick → tududi

| TickTick | tududi |
|---|---|
| Grupos 💼Trabalho / 👤Pessoal | **Areas** |
| Lista 🚀Projetos | **Projects** (dentro da Area) |
| Lista ⚡Ações | tarefas `not_started`/`in_progress` sem projeto ou no projeto |
| Lista ⏰Aguardando | tarefas com status **waiting** + View fixada |
| Lista 📌Delegadas | tarefas com **assigned_to** (People) + View por pessoa |
| Lista 🎯Algum dia/Talvez | tag `algum-dia` + View fixada |
| Tags hierárquicas de contexto | tags planas com prefixo: `d-rapido`, `d-medio`, `d-demorado`, `e-alta`, `e-media`, `e-baixa` |
| Hábitos de revisão | Habits do tududi (mesmos 3, mesmos horários) |

### Seção 2 — Passo a passo de configuração

Instruções clicáveis na UI, na ordem: criar as 2 Areas; cadastrar as pessoas
em People (lista real: daniel, everson, gisele, joão, karolina, paulo, rh, ti,
auditoria, contabilidade); criar as tags de contexto; criar e **fixar na
sidebar** as Views: "⏰ Aguardando" (`task_status=waiting`), "📌 Delegadas"
(uma por pessoa de maior volume, ou geral), "🎯 Algum dia" (tag `algum-dia`);
criar os 3 hábitos com recorrência e lembrete.

### Seção 3 — Ritmo de revisão

- Diário (seg-sex 9h): processar Inbox até zerar (cada item vira task, nota ou
  lixo — `docs/04-inbox-page.md`).
- Sexta 8h30: abrir a View Delegadas, cobrar/atualizar cada item.
- Sexta 16h ("Encerrar a semana"): Today/Overdue limpos, View Aguardando
  revisada, projetos **stalled** (`docs/06-projects.md`) reativados ou
  despachados para `algum-dia`, Views de Algum dia varridas por promoções.

### Seção 4 — Captura

- UI: Inbox (atalhos em `docs/04`).
- Telegram: bot já integrado.
- Agentes: `add_to_inbox` via MCP (referenciar `skills/tududi-mcp/SKILL.md`).

Registrar o guia no índice do `CLAUDE.md` (tabela "Comportamento do produto")
e em `docs/` conforme o padrão dos outros arquivos.

## Critério de pronto

- [ ] `docs/17-gtd-setup.md` criado com as 4 seções.
- [ ] Toda referência de UI conferida contra o app real (nomes de menu/telas
      atuais — subir com `npm start` e verificar; não copiar às cegas).
- [ ] Índices atualizados (CLAUDE.md).

## Commit

`docs: add GTD setup guide mapping the TickTick workflow` — corpo citando
"Implements plans/17". Sem push. Mesmo commit: banner EXECUTADO + tabela do
README.
