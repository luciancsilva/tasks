# 18 — Skill `tududi-mcp`: manutenção e instalação

> **Status: EXECUTADO** em 2026-07-17 — skill atualizada após 14a/14b: regra 1
> (`delete_task` seguro), regra 3 (today/upcoming filtram data de verdade),
> regra 4 (enum de status correto, `waiting`/`archived` acessíveis) e a receita
> "O que tenho para hoje?" (`list_tasks {type:'today'}`); bloco de quote das
> ressalvas 14x removido. Tudo conferido contra `backend/modules/mcp/tools/taskTools.js`.
> **Ação do dono: re-sincronizar a cópia instalada** (skillshare / `~/.claude`).
> Branch `main`.

> **Prioridade: BAIXA** — **Esforço: baixo** — **Julgamento: não exige** —
> **Depende de: 14a/14b apenas para ATUALIZAR a skill** (a v1 já documenta os
> bugs atuais como armadilha) — **Branch: `main` direto** (doc/skill)

## Contexto

`skills/tududi-mcp/SKILL.md` (criada em 2026-07-17, junto com este plano)
ensina um agente menos capaz a usar as 44 tools do MCP do tududi sem tentativa
e erro: regras de ouro, identificadores por entidade, mapeamentos divergentes,
receitas e erros comuns. Fica **versionada no repo** em `skills/` porque
`.claude*` é gitignored (`.gitignore:18`) — o diretório canônico do Claude
Code não pode ser versionado aqui.

A **instalação é do dono** (decisão do checkpoint 2026-07-17); nenhum agente
instala nada fora do repo.

## Instalação (executada pelo dono, não por agente)

Qualquer uma das opções:

1. **skillshare (recomendado, cobre todos os CLIs)**
   ```bash
   cp -r skills/tududi-mcp ~/.config/skillshare/skills/tududi-mcp
   skillshare sync
   ```
2. **Só Claude Code, global**: copiar para `~/.claude/skills/tududi-mcp/`.
3. **Só este checkout**: copiar para `.claude/skills/tududi-mcp/` (gitignored,
   sobrevive local).

A skill só funciona de fato num ambiente cujo cliente MCP esteja apontado para
o servidor do tududi (`FF_ENABLE_MCP=true` + token; setup em
`docs/14-mcp-integration.md`).

## Tarefas de manutenção (para agente executor)

Quando `plans/14a` e `plans/14b` forem marcados EXECUTADO:

1. Editar `skills/tududi-mcp/SKILL.md`:
   - remover das "Regras de ouro" as ressalvas "enquanto o plano 14x não
     estiver EXECUTADO" (regras 1, 3 e 4) e o bloco de quote logo abaixo;
   - regra 1 vira: "`delete_task` usa o caminho seguro do backend (anexos e
     recorrência tratados); ainda assim, confirme deletes com o dono";
   - regra 3/4 viram a descrição do comportamento novo: enum
     `not_started|pending|in_progress|done|completed|waiting|planned|archived|cancelled`,
     `type=today` = due até hoje OU flag today (não concluídas/arquivadas/
     canceladas), `type=upcoming` = due nos próximos 7 dias;
   - atualizar a receita "O que tenho para hoje?" para usar
     `list_tasks {type: 'today'}` direto.
2. Conferir contra o código (`backend/modules/mcp/tools/taskTools.js`) que a
   descrição bate com o implementado — transcrever, não presumir.
3. Avisar o dono no resumo que a cópia instalada (skillshare/`~/.claude`)
   precisa ser re-sincronizada por ele.

## Critério de pronto (da manutenção)

- [ ] Skill sem referências a bug já corrigido.
- [ ] Toda afirmação sobre tool conferida contra o código atual.

## Commit

Skill v1 + este plano: `docs(skills): add tududi-mcp skill for MCP-driven agents`
(corpo: "Implements plans/18"). Atualizações posteriores:
`docs(skills): update tududi-mcp skill after plans/14a-14b` . Sem push.
