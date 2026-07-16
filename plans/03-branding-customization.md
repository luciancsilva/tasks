# Frente 3 — Personalização de logo, favicon e nome da ferramenta

## Estado atual mapeado

### Logo

Assets estáticos em `public/`: `wide-logo-light.png`, `wide-logo-dark.png`, `icon-logo.png`, `login-gfx.png`. Referências no frontend (todas com o par light/dark escolhido por tema):

- `frontend/components/Navbar.tsx:190-193`
- `frontend/components/Sidebar/SidebarHeader.tsx:19-22`
- `frontend/components/Login.tsx:188-191`
- `frontend/components/Register.tsx:114, 158, 231`
- `frontend/components/Auth/OIDCCallback.tsx:37-40`
- `frontend/components/About.tsx:45-46`

### Favicon

- `public/index.html:132-136` — links `favicon.ico`, `favicon-32.png`, `favicon-16.png`, `apple-touch-icon.png`.
- `public/manifest.json` — ícones PWA e `"name"/"short_name": "tududi"`.

### Nome "tududi" hardcoded

- `public/index.html:38` — `<title>tududi</title>`.
- `public/manifest.json` — name/short_name.
- `alt="tududi"` nos componentes de logo listados acima.
- `frontend/utils/backupService.ts:153` — nome do arquivo de backup (manter).
- E-mails: `backend/config/config.js:45` — `EMAIL_FROM_NAME || 'Tududi'` (já configurável via env; fora do escopo do settings de UI, documentado como fallback).
- Menções em textos de ajuda (McpTab, TelegramTab, CalDAV, About) são conteúdo sobre o produto tududi em si — **não** trocar.

### Menu de configurações existente

`frontend/components/Profile/tabs/*.tsx` com `TabsNav.tsx`; padrão: componente `XxxTab` recebendo `isActive`, usando `useTranslation()`. Novo `AppearanceBrandingTab` (nome final: `BrandingTab`) segue esse molde. Backend admin: módulo `backend/modules/admin/` (controller/service/repository/routes) — endpoints de administração.

### Modelagem de dados — decisão

Personalização de marca é **global da instância**, não por usuário: logo/favicon/título aparecem em telas pré-login (Login, Register, OIDCCallback), onde não existe usuário. O código já tem o lugar exato para isso: tabela `settings` key/value global (`backend/models/setting.js`, migration `20251019000000-create-settings.js`), usada hoje por `registration_enabled` (`backend/modules/auth/registrationService.js:11-24`).

Chaves novas: `branding_app_name`, `branding_logo_light`, `branding_logo_dark`, `branding_favicon` (valores = URLs `/api/branding/asset/...` ou vazio = default). Edição restrita a admin (mesmo critério do módulo admin existente). Sem migration nova — a tabela já existe e `Setting.upsert` cobre.

### Upload

Reusar o pipeline R2 existente: `r2Service.getUploadStorage('branding', ...)` (`backend/services/r2Service.js:73-110`), multer com filtro de imagem igual ao de project-image (`backend/modules/projects/routes.js:20-38`), + `ico`/`svg`/`png` para favicon. Limite menor (2 MB) para branding. Sem redimensionamento server-side (sem dependência de sharp — documentar tamanho recomendado no help text).

**Ponto crítico**: o proxy de uploads `/api/uploads/:prefix/:filename` exige autenticação (`backend/app.js:259-265`), mas logo/favicon precisam aparecer pré-login. Solução: rota pública `GET /api/branding` (JSON com as 4 chaves) + `GET /api/branding/asset/:filename` (stream do R2 `branding/`, sem auth, cache público). Superfície pública mínima: só objetos sob o prefixo `branding/`, filename validado.

Ao trocar/limpar um asset de branding, deletar o objeto R2 antigo (padrão avatar, `backend/modules/users/service.js:225-232` — coerente com Frentes 1/2).

### Fallback

- Backend: `GET /api/branding` responde `{ app_name: null, ... }` quando não customizado.
- Frontend: contexto/hook `useBranding()` busca `/api/branding` no boot; componentes usam `branding.logoLight || 'wide-logo-light.png'` etc.; `document.title = branding.appName || 'tududi'`; favicon trocado em runtime reescrevendo os `<link rel="icon">`. Sem customização, o render é byte-a-byte o atual.
- `manifest.json` permanece estático (limitação documentada: nome/ícone PWA instalado não muda — exigiria manifest dinâmico; fora do escopo).

### i18n

- Biblioteca: `i18next` + `react-i18next` + `i18next-http-backend` (`frontend/i18n.ts`); arquivos em `public/locales/<lang>/translation.json`, 25 idiomas (ar, bg, da, de, el, en, es, fi, fr, id, it, jp, ko, nl, no, pl, pt, ro, ru, sl, sv, tr, ua, vi, zh).
- Convenção: chaves aninhadas por domínio (`profile.*`, `settings.*`), uso `t('chave', 'Default em inglês')`.
- Novas chaves sob `profile.branding.*` (title, appName, appNamePlaceholder, logoLight, logoDark, favicon, upload, remove, help, saved, invalidImage). Adicionar em **todos os 25** arquivos de locale (default inglês inline no código garante fallback mesmo se faltar).

## Implementação

1. Backend `backend/modules/branding/` (routes + service): GET público `/api/branding`; PUT `/api/branding` (admin) para `app_name`; POST `/api/branding/asset` (admin, multer R2 `branding/`) por tipo (`logo_light|logo_dark|favicon`); DELETE por tipo (admin) limpando setting + objeto R2; GET público `/api/branding/asset/:filename` streaming do R2. Registrar em `backend/app.js`.
2. Frontend: `BrandingContext` + fetch no boot (`App.tsx`); aplicar `document.title` + favicon dinâmico; substituir referências hardcoded pelos valores com fallback; nova aba em Profile (visível só para admin) seguindo `GeneralTab`.
3. i18n: chaves em 25 locales.
4. Testes: integração backend (get default, upsert nome, upload/remoção com mock R2, restrição de admin, fallback).
