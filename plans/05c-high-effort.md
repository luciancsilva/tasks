# 05c — Cobertura de testes do frontend: BrandingTab e GeneralTab avatar

> **Status: EXECUTADO** em 2026-07-17 — duas suítes novas em
> `frontend/components/Profile/tabs/__tests__/` (31 testes). Frontend passou de
> 4 suítes/65 testes para 6/96. Nenhum código de produção alterado.

Origem: itens do levantamento `05-future-improvements.md`, segregados por esforço.
Regras gerais: `plans/README.md`.

> **HE-1 EXECUTADO** em 2026-07-17 — `routes.js` do módulo tasks reduzido de 1064
> para 39 linhas via `controller.js` + `service.js`. Item removido deste plano.

> **HE-2 reescrito** em 2026-07-17 — era "cobertura de testes do frontend" como
> regra de revisão contínua, sem critério de pronto. Virou este plano fechado,
> com dois alvos explícitos. O contínuo foi descartado como trabalho rastreado.

## Registro da execução

Duas correções de rumo em relação ao que o plano previa, ambas de fixture:

- **`branding[kind]` guarda a URL pública**, `/api/branding/asset/<filename>`
  (`backend/modules/branding/service.js:26`), **não** a key do R2. O primeiro
  fixture usava a key; o teste passava, mas caracterizava um caso que nunca
  ocorre. O valor real exercita algo melhor: `getApiPath` é idempotente para
  caminho que já começa com `api/` (`frontend/config/paths.ts:85-89`), então não
  duplica o prefixo. É isso que o teste trava agora.
- **`avatar_image` guarda `/uploads/avatars/<filename>`** com barra inicial
  (`backend/modules/users/service.js:231`), roteado pelo proxy `/api/uploads`.

Os dropdowns filhos do `GeneralTab` (`LanguageDropdown`, `TimezoneDropdown`,
`FirstDayOfWeekDropdown`) são puros — recebem tudo por prop, não tocam a rede.
Não precisaram de mock, ao contrário do que o plano supunha como risco.

O guarda `getSafeAvatarUrl` foi coberto como está, sem "consertar" a
case-sensitivity — confirmado que `getApiPath` sempre prefixa `api/` e devolve
caminho relativo, então `JavaScript:` não vira URL executável.

---

## HE-2. Cobrir BrandingTab e o avatar do GeneralTab

### Por quê estes dois

O frontend tem **4 suítes** hoje (`MarkdownRenderer.checkbox`, `TaskContentCard`,
`RecurrenceDisplay`, `dateUtils`). Nenhuma cobre Profile, que é a maior superfície
sem teste. Destes dois alvos:

- `GeneralTab.getSafeAvatarUrl()` é **guarda de XSS** com 5 ramos e zero teste.
- `BrandingTab` tem 3 handlers de rede (`saveAppName`, `uploadAsset`,
  `removeAsset`), cada um com caminho de sucesso e de erro, e todos só
  exercitados hoje pelo E2E Playwright.

Ambos são componentes com lógica condicional de dados — testáveis sem subir a app.

### Padrão a seguir (já usado no repo)

Ver `frontend/components/Task/__tests__/RecurrenceDisplay.test.tsx:1-16`:

- Testing Library (`@testing-library/react`) + `@testing-library/jest-dom`.
- **Suítes são colocadas** ao lado do componente, em `__tests__/` irmão.
  Alvo: `frontend/components/Profile/tabs/__tests__/`.
- **Sem `msw`** — não é dependência do projeto. Mock com `jest.mock` do módulo.
- i18n: mockar `react-i18next` com `t: (_key, fallback) => fallback`, para os
  fallbacks em inglês renderizarem literalmente e servirem de seletor.
- Jest lê `jest.config.js` (preset `ts-jest`, env `jsdom`, setup em
  `frontend/__tests__/setup.ts`). Rodar: `npm run frontend:test`.

### Passo 1 — `GeneralTab` avatar

**Arquivo**: `frontend/components/Profile/tabs/GeneralTab.tsx`, função
`getSafeAvatarUrl()` em `:53-78`, consumida em `:80`.

Comportamento real, lido do código (não presumir):

| Entrada | Retorno esperado |
|---|---|
| `avatarPreview` começa com `data:` ou `blob:` | o próprio `avatarPreview` |
| `avatarPreview` com qualquer outro valor | `''` |
| sem preview, `formData.avatar_image` começa com `javascript:`, `data:`, `vbscript:` ou `file:` | `''` |
| sem preview, `formData.avatar_image` normal | `getApiPath(url)` |
| sem preview e sem `avatar_image` | `''` |

Testes a escrever (via render, não chamando a função — ela é interna):

1. `avatarPreview='data:image/png;base64,xxx'` renderiza `<img>` com esse `src`.
2. `avatarPreview='http://evil.test/x.png'` **não** renderiza `<img>` — cai no
   placeholder `UserCircleIcon` (`:98-100`). Asserção: `queryByRole('img')` nulo.
3. `formData.avatar_image='javascript:alert(1)'` cai no placeholder.
4. `formData.avatar_image='uploads/avatars/a.png'` renderiza `<img>` com o `src`
   já prefixado por `getApiPath` (`/api/uploads/avatars/a.png` sem base path).
5. `isActive=false` renderiza `null` (`:51`).
6. Botão "Remove Avatar" só aparece quando há `avatar_image` ou `avatarPreview`
   (`:121-129`); clicar chama `onAvatarRemove`.
7. Selecionar arquivo no input `#avatar-upload` (`:107-118`) chama
   `onAvatarSelect` com o `File`. Use `fireEvent.change` com `files`.

**Não "consertar" a guarda.** Ela é case-sensitive (`JavaScript:` passa), mas
`getApiPath` (`frontend/config/paths.ts:82-90`) sempre prefixa `api/` e devolve
caminho relativo, então o bypass não vira URL executável. É defesa em
profundidade, não a única barreira. Se quiser mudar, é plano novo.

**Props obrigatórias** (`GeneralTabProps`, `:20-33`): o componente exige
`timezonesByRegion`, `getRegionDisplayName`, e os handlers `onChange`,
`onAppearanceChange`, `onLanguageChange`, `onTimezoneChange`, `onFirstDayChange`.
Monte um factory de props no topo da suíte com `jest.fn()` e `{}` /
`(r: string) => r`. Os dropdowns filhos (`LanguageDropdown`, `TimezoneDropdown`,
`FirstDayOfWeekDropdown`, `:11-13`) podem precisar de `jest.mock` se puxarem
rede — verifique e mocke só se quebrar.

### Passo 2 — `BrandingTab`

**Arquivo**: `frontend/components/Profile/tabs/BrandingTab.tsx` (256 linhas).

Dependências a mockar:

- `../../../utils/csrfService` → `fetchWithCsrf` como `jest.fn()`.
  (O real busca `/api/csrf-token` na primeira chamada, `csrfService.ts:16`.)
- `../../../contexts/BrandingContext` → `useBranding` devolvendo
  `{ branding, refreshBranding: jest.fn() }`. Interface `Branding`
  (`BrandingContext.tsx:10-15`): `app_name`, `logo_light`, `logo_dark`,
  `favicon`, todos `string | null`.
- `../../Shared/ToastContext` → `useToast` devolvendo
  `{ showSuccessToast: jest.fn(), showErrorToast: jest.fn() }`. O real **lança**
  fora do provider (`ToastContext.tsx:80-83`), então o mock não é opcional.

Testes a escrever:

1. `isActive=false` renderiza `null` (`:35`).
2. Input de nome inicializa com `branding.app_name` e o `useEffect` (`:31-33`)
   re-sincroniza quando a prop muda (`rerender` com novo `app_name`).
3. **Save do nome** (`:37-60`): digitar, clicar "Save", esperar
   `fetchWithCsrf` chamado com `getApiPath('branding')`, method `PUT`, body
   `{"app_name":"..."}` **trimado**. Depois: `refreshBranding` chamado e
   `showSuccessToast`.
4. **Save com `response.ok=false`**: `showErrorToast`, e `refreshBranding`
   **não** chamado.
5. **Upload** (`:62-89`): `fireEvent.change` no input file do `logo_light`
   dispara POST em `branding/asset/logo_light` com `FormData` contendo `file`.
   Asserte que o body é `instanceof FormData` — não tente ler o conteúdo, jsdom
   não expõe bem.
6. **Remove** (`:91-115`): botão "Remove" só existe quando `branding[kind]` tem
   valor (`:231`); clicar dispara DELETE em `branding/asset/<kind>`.
7. **Estado `busy`**: enquanto o fetch não resolve, os botões ficam `disabled`
   (`:170`, `:226`, `:234`). Resolva a promise manualmente para observar.
8. Linha de asset sem valor mostra "Default" (`:200-206`); com valor renderiza
   `<img>` com `getApiPath(currentUrl)` (`:193-198`).

### Critério de pronto

- Duas suítes novas em `frontend/components/Profile/tabs/__tests__/`:
  `GeneralTab.avatar.test.tsx` e `BrandingTab.test.tsx`.
- `npm run frontend:test` verde, sem `console.error` de act() ou de prop
  faltando.
- Nenhum arquivo de produção alterado. Se um teste só passa mudando o
  componente, **pare e reporte** — ou é bug real (plano novo) ou o teste está
  errado.
- Lint dos arquivos novos: `npx eslint <arquivo>` de dentro da raiz.
- Commit único: `test(frontend): cover BrandingTab and the avatar guard`,
  corpo citando "Implements plans/05c HE-2".
- Encerrar conforme `plans/README.md` §6 (banner + mover linha para Executados).

### Fora de escopo

- ProfileSettings (~1500 linhas) e as outras abas.
- Fluxos de upload de anexo de tarefa e capa de projeto.
- Qualquer mudança em código de produção.
