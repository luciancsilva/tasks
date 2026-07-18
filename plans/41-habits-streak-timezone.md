# 41 — Streak de hábito usa fuso do servidor sobre `completed_at` em UTC

> **Status: PROPOSTO** — o cálculo de streak agrupa completions por dia usando `setHours(0,0,0,0)` no fuso do processo, mas `completed_at` é UTC; fora de UTC, completions perto da meia-noite caem no dia errado e o streak conta/quebra incorretamente.
> **Esforço:** Médio · **Natureza:** julgamento · **Modelo:** médio (sonnet)
> **Branch:** main · **Depende de:** -

## Diagnóstico

`backend/modules/habits/habitService.js`:
- `calculateBestStreak` (L85-125): `completedDate = new Date(completion.completed_at)`
  seguido de `completedDate.setHours(0, 0, 0, 0)` (L98-99) — meia-noite no fuso do
  processo Node.
- `calculateCalendarStreak` (L151-175): mesma coisa em `currentDate.setHours(0,0,0,0)`
  (L154) e no map de `completionDates` (L156-160, `d.setHours(0,0,0,0)`).

`completed_at` é gravado em UTC (`backend/models/recurringCompletion.js`,
`completed_at: DataTypes.DATE`). O resto do app resolve o fuso por usuário (helper
`getSafeTimezone`, usado em queries de "hoje"). Aqui o dia é derivado no fuso do
servidor, não do usuário do hábito.

Consequência: para servidor ou usuário fora de UTC, uma completion às 23h locais (ou
01h) cai no "dia" UTC adjacente, então dias consecutivos podem parecer com gap (streak
quebra) ou duas completions do mesmo dia local parecem dias diferentes.

## Implementação Proposta

1. Determinar o fuso do usuário dono do hábito (a `task`/hábito tem `user_id`; carregar
   o `User.timezone` via `getSafeTimezone`, como os demais serviços fazem). Avaliar
   passar o timezone como parâmetro para as funções puras de streak, mantendo-as
   testáveis.
2. Trocar o "truncar para o dia" baseado em `setHours` local por truncamento no fuso do
   usuário. Preferir a lib já presente no projeto (`moment-timezone` está no stack de
   datas; confirmar em `package.json`) em vez de manipular `Date` cru.
3. Aplicar em `calculateBestStreak`, `calculateCalendarStreak` e no `asOfDate` de
   `calculateCurrentStreak` (L130-146) para consistência.

## Critério de Pronto

- Teste unitário com `TZ` do processo ≠ UTC (ex.: `America/Sao_Paulo`): duas completions
  em dias locais consecutivos, uma delas perto da meia-noite, produzem streak = 2.
- Teste: completion às 23:30 local e outra às 00:30 local do dia seguinte contam como
  dois dias (não um).
- Suíte backend verde; lint dos arquivos tocados.
