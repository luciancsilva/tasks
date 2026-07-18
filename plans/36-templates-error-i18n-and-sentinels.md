# 36 — templates: fallback PT hardcoded + roteamento de erro por string sentinela

> **Status: PROPOSTO** — a robustez de erro do Templates (plano 30) usa fallback em português direto no `t()` e roteia por comparação de `error.message` com strings sentinela. Achado no code-review do lote 24–32.
> **Esforço:** Baixo · **Natureza:** convenção/robustez · **Modelo:** fraco (haiku).
> **Branch:** `main` · **Depende de:** -

## Diagnóstico

- `frontend/components/Templates/Templates.tsx` (~147+): vários handlers usam
  `t('templates.error404', 'Recurso indisponível. Reinicie o servidor backend.')`
  — fallback **em português** enquanto o padrão do repo é fallback em **inglês**
  (a tradução PT vem do locale). Inconsistente e duplicado em 6 handlers.
- `frontend/utils/templatesService.ts`: `checkStatus` lança `Error` com mensagens
  sentinela (`API_404_NOT_FOUND`, `API_500_SERVER_ERROR`, `API_HTML_RESPONSE`) e
  os handlers roteiam por `error.message === '...'`. Acoplamento frágil: renomear
  a string em um lado quebra o outro em silêncio.

## Implementação Proposta

1. Trocar os fallbacks PT por fallback **em inglês** nos `t(...)` e garantir as
   chaves em `public/locales/{en,pt}/translation.json`.
2. Extrair as sentinelas para constantes compartilhadas (ex.:
   `export const TEMPLATE_API_ERROR = { NOT_FOUND: 'API_404_NOT_FOUND', ... }`)
   ou usar uma classe de erro com `code` em vez de comparar `message` cru;
   handlers e `checkStatus` importam a mesma fonte.
3. Deduplicar o bloco de roteamento de erro repetido nos 6 handlers num helper.

## Critério de Pronto

- `npm run frontend:test`.
- Teste: 404 e 500 continuam mostrando as mensagens específicas via as constantes
  compartilhadas.
- Lint dos arquivos tocados.
