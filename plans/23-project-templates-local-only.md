# 23 — Trazer "Project Templates" do upstream, sem a parte de Marketplace

> **Status: EXECUTADO** em 2026-07-17 — portada a parte local do commit upstream
> `2df928b9`: migration + campos de template em `projects`, módulo backend
> `templates/` (CRUD, save-as-template, clone com offset de data e subtasks),
> página `/templates` + modais no frontend, link "Templates" na Navbar, "Save as
> Template" no ProjectItem e "From Template" em Projects. Marketplace deixado de
> fora (sem `MARKETPLACE_URL`, sem componentes `Marketplace*`, sem proxy remoto).
> Repository reescrito sem `BaseRepository` (inexistente no fork); strings de UI
> em `t()` com chaves novas em `en`/`pt`. Teste `templates.test.js` (6 casos).
>
> **Status anterior: PROPOSTO** em 2026-07-17
> **Escopo:** Adaptar (não aplicar direto) o commit upstream `2df928b9`
> (`feat(templates): project templates + marketplace`, issue #979) trazendo
> **só** a parte local — salvar projeto como template, clonar template em
> projeto novo com offset de datas — e **deixando de fora** a integração com
> o marketplace remoto (`tududi-cloud`, env var `MARKETPLACE_URL`).
> **Depende de:** -
> **Origem:** avaliado durante sincronização com upstream via `git-review.md`
> (2026-07-17). Classificado como `Skip` automático no ciclo de sync porque é
> feature nova grande, não bugfix — exige decisão do dono. Dono decidiu: quer
> a parte local, não quer marketplace (conversa da sessão).

## Diagnóstico

O commit upstream `2df928b9` (29 arquivos, ~2755 linhas) mistura duas coisas
na mesma PR:

**Parte local (trazer):**
- Migration `20260714000001-add-template-fields-to-projects.js`: adiciona
  `is_template`, `template_category`, `clone_count`, `source_template_id` em
  `projects`.
- `backend/models/project.js`: campos e associação `source_template_id` self-FK.
- `backend/modules/templates/`: CRUD de template, clone (com lógica de
  offset de data), save-as-template. **Mas** `service.js` (589 linhas) e
  `routes.js` (215 linhas) têm a lógica de marketplace **misturada** — precisa
  extrair só as funções de CRUD/clone/save-as-template locais.
- Frontend: `Templates.tsx` tem aba "My Templates" e aba "Marketplace" na
  mesma página — manter só a primeira. `TemplateCard.tsx`,
  `TemplateCloneModal.tsx`, `TemplatePreviewModal.tsx`: locais, trazer
  inteiros. `frontend/entities/Template.ts`, `templatesService.ts`: revisar
  se têm chamada pro endpoint de marketplace misturada.
- `ProjectItem.tsx`: item "Save as Template" no dropdown do card.
- `Projects.tsx`: link "From Template" no header.
- `Navbar.tsx`: link "Templates" no dropdown do usuário (reordena o menu
  inteiro — conferir se mexe em algo que este fork já customizou, ex.:
  branding).
- `frontend/store/useStore.ts`: estado de templates.

**Parte marketplace (deixar de fora):**
- `backend/.env.example` e `backend/config/config.js`: env var
  `MARKETPLACE_URL`.
- `backend/modules/templates/service.js`/`routes.js`: proxy pro marketplace
  remoto (`tududi-cloud`) — funções a identificar e não portar.
- `frontend/components/Templates/MarketplacePreviewModal.tsx`,
  `MarketplaceTemplateCard.tsx`, `MarketplaceTemplates.tsx`: não trazer.
- `Profile/tabs/FeaturesTab.tsx`, `Profile/ProfileSettings.tsx`: conferir se o
  toggle adicionado é só do marketplace (nesse caso não trazer) ou também
  cobre a feature de templates como um todo (nesse caso avaliar).

### Risco de conflito conhecido

`git-review.md` mapeia duas áreas de conflito garantido neste fork: **i18n**
(upstream usa string hardcoded em inglês, este fork usa `t()`) e
**BaseRepository/estrutura de módulo** (removido aqui, `routes.js` de outros
módulos tem tamanho muito diferente lá). O módulo `templates/` é novo aqui
(não existe ainda), então não há conflito estrutural de merge — mas qualquer
string de UI trazida precisa ser convertida pra `t()` na adaptação, não
copiada como hardcode.

## Implementação Proposta

1. Trazer a migration e o campo em `project.js` como estão (não têm marketplace).
2. Recriar `backend/modules/templates/` só com as rotas/serviço de: criar
   template a partir de projeto existente, listar templates do usuário, clonar
   template em projeto novo (com offset de data), deletar template. Sem rota
   de proxy pro marketplace.
3. Recriar o frontend do módulo Templates sem a aba/componentes de
   Marketplace. Toda string de UI nova em `t()`, chaves novas em
   `frontend/locales/en` e `frontend/locales/pt` (conferir idioma canônico
   deste fork — provavelmente pt-BR primeiro dado o README).
4. Link "Templates" na Navbar e "Save as Template"/"From Template" nos
   pontos que o upstream adicionou, sem o texto/toggle de marketplace.
5. Teste de integração cobrindo: criar template a partir de projeto, clonar
   template com offset de data (incluindo subtasks — o upstream teve um bug
   aqui, `subtasks` minúsculo vs `Subtasks`, conferir se a versão local
   trazida já nasce correta), deletar template.
6. **Não criar `MARKETPLACE_URL`** em `.env.example`/`config.js` neste plano.
   Se o dono quiser marketplace depois, é plano novo.

## Critério de Pronto

- `npm run backend:test` e `npm run frontend:test` limpos.
- Fluxo manual: salvar projeto existente como template, clonar template em
  projeto novo, conferir datas com offset e subtasks presentes.
- Nenhuma referência a `MARKETPLACE_URL`, proxy remoto, ou componentes
  `Marketplace*` no código trazido.
- Toda string de UI nova passa por `t()`, chaves presentes nos arquivos de
  locale do fork.
