> **Status: EXECUTADO** em 2026-07-18 — `getCachedBrief` agora compara `ai_daily_brief_date` com a data de hoje no fuso do usuário (moment-timezone) e retorna `null` quando desatualizado; 5 testes unitários adicionados.

# 45 — Daily brief serve cache de dia anterior

> **Status: PROPOSTO** — `getCachedBrief` retorna o brief salvo sem comparar `ai_daily_brief_date`; o brief de ontem é servido como o de hoje até um POST regenerar.
> **Esforço:** Trivial · **Natureza:** mecânico · **Modelo:** fraco (haiku)
> **Branch:** main · **Depende de:** -

## Diagnóstico

`backend/modules/ai-assistant/service.js:223-229` (`getCachedBrief`):
```
async function getCachedBrief(userId) {
    const user = await User.findByPk(userId, {
        attributes: ['ai_daily_brief', 'ai_daily_brief_date'],   // L225
    });
    if (!user || !user.ai_daily_brief) return null;
    return user.ai_daily_brief;                                  // L228 — sem checar a data
}
```
Ele já carrega `ai_daily_brief_date` (L225) mas nunca compara. `generateDailyBrief`
grava `ai_daily_brief_date: moment().format('YYYY-MM-DD')` (`service.js:301`).

A rota `GET /ai-assistant/daily-brief` (`routes.js:7` → `controller.js:14-15`) devolve
o resultado direto. Então, ao abrir o app no dia seguinte sem regenerar, o usuário vê o
brief de ontem apresentado como o de hoje.

## Implementação Proposta

1. Em `getCachedBrief`, comparar `user.ai_daily_brief_date` com a data de hoje **no fuso
   do usuário** (carregar `timezone` junto e usar `getSafeTimezone`/`moment`, consistente
   com o resto do app) e retornar `null` se não bater — forçando o front a chamar o POST
   de regeneração (fluxo já existente).
2. Manter o shape de retorno (`null` quando não há cache válido) — o controller
   (`controller.js:15`) já trata `brief || null`.

## Critério de Pronto

- Teste: `ai_daily_brief_date` = ontem → `getCachedBrief` retorna `null`.
- Teste: `ai_daily_brief_date` = hoje → retorna o brief salvo.
- Suíte backend verde; lint dos arquivos tocados.
