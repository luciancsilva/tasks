# 34 — inbox: semântica de `@pessoa` inconsistente entre composer e detail

> **Status: EXECUTADO** em 2026-07-18 — no caminho de criação direta do composer (`QuickCaptureInput` handleSubmit), a primeira `@pessoa` vira `assigned_to` (first-wins, coerente com o InboxItemDetail e a decisão do dono); as demais menções ficam como `InvolvedPeople`. Pessoa nova (sem uid) não é atribuível client-side, então segue toda como InvolvedPeople (backend auto-cria) — sem perda. O botão do footer abre o modal (usuário finaliza), então não foi alterado. Frontend 112 verde.
> **Esforço:** Médio · **Natureza:** julgamento (muda comportamento) · **Modelo:** médio/forte.
> **Branch:** `main` · **Depende de:** -

## Diagnóstico

- Composer `frontend/components/Inbox/QuickCaptureInput.tsx` (~1585-1592 e
  ~1804-1815): `newTask` recebe `people: taskPeople` (InvolvedPeople) e **nunca**
  seta `assigned_to`.
- Detail `frontend/components/Inbox/InboxItemDetail.tsx` (~190-217): resolve a
  primeira pessoa e seta `assigned_to: assignedToUid` (first-wins), conforme a
  decisão de produto do plano 26.

Efeito: criar tarefa pelo **composer** da inbox com `@fulano` deixa a tarefa
"Não atribuído" (assigned_to vazio) — o bug 10 persiste nesse caminho —, enquanto
converter um **item salvo** com `@fulano` seta o assignee. Comportamento
divergente para a mesma entrada.

## Decisão pendente (dono)

A decisão registrada foi `@pessoa` = `assigned_to` (single, first-wins). Duas
saídas possíveis, precisa confirmação:
1. **Unificar em `assigned_to`** — composer passa a setar `assigned_to` (primeira
   pessoa) em vez de `people`. Risco: quebra semântica de multi-@ e testes que
   esperam `people`/InvolvedPeople no composer.
2. **Manter `people` no composer e também espelhar no detail** — @pessoa vira
   InvolvedPeople nos dois; então o card/detalhe (plano 25) deveria exibir
   InvolvedPeople, não assigned_to. Contraria a decisão do plano 25/26.

Recomendação: opção 1 (coerente com 25/26), mas confirmar antes de mudar
comportamento, porque afeta InvolvedPeople.

## Implementação (após decisão 1)

No composer, ao montar `newTask`, resolver a primeira pessoa parseada e setar
`assigned_to` (auto-criar Person se novo, como o detail faz via `createPerson`),
removendo/ajustando o `people: taskPeople` conforme a decisão sobre multi-@.

## Critério de Pronto

- `npm run frontend:test` + backend se afetar payload.
- Teste: criar via composer com `@fulano` → `assigned_to` setado, consistente com
  o caminho do detail.
- Verificação: `@fulano` pelo composer e pelo item salvo produzem o mesmo
  vínculo.
