# 22 — Baseline do `frontend:test` vermelha: `remark-breaks` (ESM) quebra o Jest

> **Status: EXECUTADO** em 2026-07-17 -- Configurado transformIgnorePatterns e transform no jest.config.js para transpilar pacotes ESM-only da cadeia remark/unist (remark-breaks, mdast-util-newline-to-break, mdast-util-find-and-replace, escape-string-regexp, unist-util-visit-parents, unist-util-is).
> **Escopo:** Configurar `transformIgnorePatterns` (ou equivalente) em `jest.config.js`
> para que o Jest transpile pacotes ESM-only usados por `MarkdownRenderer.tsx`
> (`remark-breaks`, e possivelmente `remark-gfm`/outros da cadeia `unified`/`remark`),
> restaurando a suíte `frontend/components/Shared/__tests__/MarkdownRenderer.checkbox.test.tsx`
> a verde.
> **Depende de:** -
> **Origem:** achado pelo agy (Gemini 3.1 Pro High, execução delegada) ao tentar
> rodar a baseline do plano `21-inbox-mention-cleanup-ascii-regex.md` — baseline
> veio vermelha, execução do 21 foi corretamente interrompida antes de qualquer
> mudança (regra "baseline vermelha = parar e reportar").
> **Bloqueia:** `21-inbox-mention-cleanup-ascii-regex.md` (mesma suíte `frontend:test`
> precisa estar verde antes de medir o efeito do fix do 21).

## Diagnóstico

`npm run frontend:test` falha com:

```
Test Suites: 1 failed, 8 passed, 9 total
Tests: 98 passed, 98 total

FAIL frontend/components/Shared/__tests__/MarkdownRenderer.checkbox.test.tsx
  Jest encountered an unexpected token
  C:\projects\tasks\node_modules\remark-breaks\index.js:1
  export {default} from './lib/index.js'
  ^^^^^^
  SyntaxError: Unexpected token 'export'
```

`frontend/components/Shared/MarkdownRenderer.tsx:3-4` importa `remarkGfm` e
`remarkBreaks` (`remark-gfm`, `remark-breaks`), pacotes publicados como ESM puro
(sem build CJS) — comum em toda a cadeia `unified`/`remark`/`react-markdown`
moderna. `jest.config.js` (raiz) não define `transformIgnorePatterns`, então o
Jest usa o padrão (`node_modules/` inteiro é ignorado pelo transform) e a
sintaxe `export {default} from ...` do pacote quebra o parser CommonJS.

### Impacto

`npm run frontend:test` está **vermelho na baseline atual da `main`**, mesmo
sem nenhuma mudança de código — qualquer plano que toque frontend não consegue
estabelecer baseline limpa (já bloqueou a execução do `21`). Risco de mascarar
regressões reais nessa suíte específica se alguém assumir "vermelho == sempre foi
assim" sem investigar.

## Implementação Proposta

1. Em `jest.config.js` (raiz), adicionar `transformIgnorePatterns` liberando os
   pacotes ESM-only da cadeia markdown, ex.:
   ```javascript
   transformIgnorePatterns: [
       'node_modules/(?!(remark-breaks|remark-gfm|react-markdown|remark-.*|micromark.*|mdast.*|unist.*|unified|vfile.*|bail|is-plain-obj|trough|devlop|hast.*|property-information|space-separated-tokens|comma-separated-tokens|estree-util-is-identifier-name|zwitch|longest-streak|ccount|escape-string-regexp)/)'
   ]
   ```
   Confirmar a lista exata rodando o teste e adicionando cada pacote que acusar
   `Unexpected token 'export'` (a cadeia de dependências transitivas do
   `react-markdown` costuma ser grande — iterar até estabilizar) — **não copiar
   a lista acima sem validar contra os `node_modules` reais deste checkout**.
2. Alternativa mais simples se a lista de pacotes ficar grande demais: trocar
   `transform` da entrada `.(js|jsx)$` para também cobrir os pacotes ESM em
   `node_modules` via um pattern mais permissivo, ou avaliar `esbuild-jest`/
   `swc-jest` como transform mais tolerante — só se a abordagem 1 não resolver
   de forma razoável.
3. Rodar `npm run frontend:test` até ficar 100% verde, sem regressão nas outras
   8 suítes que já passavam.

## Critério de Pronto

- `npm run frontend:test` limpo (baseline atual: 1 failed / 8 passed → alvo:
  9/9 passed).
- Nenhuma mudança de comportamento do `MarkdownRenderer` — é só configuração de
  transform do Jest, não deve alterar snapshots nem asserts existentes.
