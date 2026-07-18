# 28 — inbox: chip de tag neutro + hint `+Projeto`

> **Status: PROPOSTO** — chips de tag na inbox aparecem em cores diferentes (azul=existe, laranja=nova), o que confunde; unificar em cor neutra. E traduzir o hint de ajuda `+Project` → `+Projeto`.
> **Esforço:** Trivial · **Natureza:** mecânico puro (1 classe CSS + 1 string i18n) · **Modelo:** fraco (haiku).
> **Branch:** `main` · **Depende de:** -

## Decisão de produto

Item 3a: chips de tag na inbox em **cor única neutra** (azul), removendo a
distinção azul(existe)/laranja(nova).

## Diagnóstico

1. **Cores (item 3a)** — `frontend/components/Inbox/InboxSelectedChips.tsx`
   `renderTagChip` (44-99): ramo "tag existe" usa azul
   (`bg-blue-50 ... text-blue-600`, 49-79); ramo "tag nova" usa laranja
   (`bg-orange-50 ... text-orange-500`, 82-98). Também conferir
   `InboxItemDetail.tsx renderMetadata` (643-660), onde tags são texto cinza.
2. **Hint (item 2)** — a ajuda do composer mostra "+Project para atribuir a um
   projeto" enquanto `#tag`/`@pessoa` já estão traduzidos. É i18n: a chave está em
   `public/locales/pt/translation.json` no bloco `inbox`.

## Implementação Proposta

1. `renderTagChip`: o ramo "tag nova" (82-98) passa a usar o mesmo estilo azul do
   ramo "existe" (49-79). Manter `data-tag-exists` como está (só a cor muda).
2. Traduzir o rótulo do token no hint PT para "+Projeto". **Atenção:** traduzir
   **somente o texto de ajuda** — o caractere de parse continua `+` (não mexer no
   parser). Confirmar se o hint é string única ou montada por partes.

## Critério de Pronto

- `npm run frontend:test`.
- Teste: chip de tag nova usa a classe azul; chave PT do hint contém "Projeto".
- Verificação manual: digitar `#nova` na inbox → chip azul; ajuda mostra
  "+Projeto".
- Lint dos arquivos tocados.
