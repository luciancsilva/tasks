# 31 — branding: validar dimensão, renomear botão, restaurar padrão

> **Status: EXECUTADO** em 2026-07-18 — Validação de dimensão via aviso soft, renomeado botão para "Selecionar novo..." e adicionado botão "Restaurar padrão".
> **Esforço:** Médio · **Natureza:** julgamento (dimensão soft-vs-block, SVG sem raster, reset agregado) · **Modelo:** médio (sonnet).
> **Branch:** `main` · **Depende de:** -

## Diagnóstico

Componente `frontend/components/Profile/tabs/BrandingTab.tsx` (257 linhas):
- "Nome da aplicação" 147-176 (`saveAppName` 37-60 → `PUT /api/branding`).
- 3 uploads (logo claro/escuro/favicon) via `assetRows` 117-130, render 178-244;
  botão "Enviar" 221-230 (chave `profile.branding.upload`, `translation.json:850`);
  `uploadAsset` 62-89 → `POST /api/branding/asset/${kind}`.
- Helper "300x72px / 32x32px" 246-251 (`profile.branding.assetHelp`) — só texto.
- Reset **por-asset** já existe: botão "Remover" 231-240 →
  `DELETE /api/branding/asset/:kind` → `clearAsset`
  (`backend/modules/branding/service.js:119`).

Validação atual: só tamanho (2MB) e ext/mime no backend
(`backend/modules/branding/routes.js:37-53`). **Sem checagem de dimensão** em
lugar nenhum.

## Implementação Proposta

**a) Validar dimensão (frontend, `uploadAsset` 62-89):** antes do upload, ler
`Image.naturalWidth/Height` e comparar com o recomendado (logo ~300x72, favicon
32x32). **Decisão de design:** manter como **aviso soft**, não bloqueio — SVG não
tem dimensão raster, e imagens levemente fora devem passar. Bloquear só casos
absurdos (ex.: favicon com lado > 512px) se desejado; default = avisar e permitir.

**b) Renomear botão:** chave `profile.branding.upload` (pt
`translation.json:850`, usada em `BrandingTab.tsx:229`) de "Enviar" →
"Selecionar novo…". Ajustar en também.

**c) Restaurar padrão:** botão "Restaurar padrão" ao lado de "Salvar alterações"
que limpa nome + 3 assets de uma vez (loop nos `assetRows` 117-130 + limpar
`app_name`), com **confirmação**. Preferir **reusar as rotas existentes**
(`DELETE /api/branding/asset/:kind` × 3 + `PUT /api/branding` com nome vazio) em
vez de criar endpoint agregador, pra não ampliar superfície.

## Critério de Pronto

- `npm run frontend:test`.
- Testes: validação avisa/rejeita dimensão fora do esperado (reusar padrão de
  teste de BrandingTab criado no plano 05c HE-2); "Restaurar padrão" dispara os
  deletes + limpa nome com confirmação.
- Verificação manual: upload fora do tamanho → aviso; botão "Selecionar novo…"
  aparece; "Restaurar padrão" volta ao default do tududi.
- Lint dos arquivos tocados.
