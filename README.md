<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="public/wide-logo-light.png">
    <source media="(prefers-color-scheme: light)" srcset="public/wide-logo-dark.png">
    <img src="public/wide-logo-light.png" alt="tududi" width="350">
  </picture>
</p>

<h1 align="center">Tududi — Fork PT-BR & Enhanced Stability</h1>

<p align="center">
  <b>Versão Modificada & Localizada (`luciancsilva/tasks`) do projeto original <a href="https://github.com/chrisvel/tududi">chrisvel/tududi</a></b><br>
  Focado em <b>Localização Completa em Português do Brasil (PT-BR)</b>, <b>Idempotência no Banco de Dados</b>, <b>Estabilidade do Backend</b> e <b>Rotinas de CI/CD</b>.
</p>

---

## 📌 Objetivo deste Fork (`README.md` Funcional)

Este repositório é um *fork* ativo do projeto [Tududi](https://github.com/chrisvel/tududi) (sincronizado até a upstream `v1.2.4`). O objetivo principal deste fork é estender o projeto com **localização nativa e total para o Português (PT-BR)**, corrigir falhas arquiteturais e de migração em cenários de auto-hospedagem (self-hosting / Docker), garantir estabilidade de testes e estabelecer um fluxo rigoroso de sincronização com a upstream (`git-review.md`).

---

## ⚡ Resumo de Todas as Alterações e Diferenças em Relação ao Projeto Original

Abaixo estão detalhadas todas as modificações, melhorias e correções exclusivas implementadas neste fork em comparação com o repositório original (`upstream/main`):

### 1. 🌐 Localização e Tradução Integral (PT-BR)
Enquanto o projeto original possui foco primário no inglês, este fork adicionou e refinou a tradução de 100% dos fluxos para o **Português do Brasil**:
- **Interface Web (Frontend)**:
  - Tradução completa das telas e visualizações: *Hoje (`TasksToday` e configurações da engrenagem)*, *Calendário (`CalendarDayView` e `CalendarWeekView`)*, *Hábitos (`Habits`)*, *Pessoas (`People`)*, *Notas (`Notes` e foco)*, e *Universal Search*.
  - Localização integral dos componentes de Tarefas: modais de edição, seções de recorrência, anexos (`TaskAttachmentsCard`), atribuição de responsáveis (`Assigned To`), prioridades e datas.
  - Correção de problemas de caixa alta/baixa (casing) e rótulos na barra lateral (*Sidebar*).
- **Formatação Nativas de Datas**:
  - Adaptação dos formatadores de data/hora nos utilitários (`dateUtils.ts`) e nas visualizações diárias e semanais para os padrões brasileiros.
- **Bot de Telegram PT-BR**:
  - Tradução completa dos comandos interativos do bot do Telegram, notificações push, resumos diários de tarefas (*daily digests*) e mensagens de erro (`telegramMessages.js`).

### 2. 🛡️ Correções Críticas de Backend e Idempotência (Migrations & Auth)
Foram resolvidas falhas estruturais do projeto original causadoras de *crash loops* no Docker e perda de acesso administrativo:
- **Resolução de Admin Idempotente (`isAdmin()`) — Plano 001**:
  - **Problema no Original**: A verificação de administrador (`isAdmin`) em `backend/modules/auth/service.js` falhava ao comparar IDs quando usuários autenticavam via OIDC/SSO ou eram gerados via testes (`id` numérico vs `uid` string UUID).
  - **Correção do Fork**: Refatoração do `isAdmin()` e middlewares de autorização para checar corretamente tanto `numeric id` quanto `uid`, além de proteção nos testes para evitar que usuários comuns ganhem privilégios administrativos silenciosamente (`36fe379a`, `a598aa3e`).
- **Migrações de Banco de Dados Idempotentes — Planos 005, 006 e 007**:
  - **Problema no Original**: As migrações do Sequelize (`add-goal-columns-to-projects`, `add-people-to-tasks`, `add-color-to-people`) executavam alterações sem verificar a existência prévia de colunas ou índices. Em re-execuções, reinicializações de contêineres Docker ou atualizações de instâncias existentes, as migrações lançavam erros fatais de SQL e travavam a inicialização do app.
  - **Correção do Fork**: Modificação estrutural e defensiva nessas migrações (*check-and-add / idempotent guard*), permitindo que o Docker suba e re-execute sem erros mesmo após falhas abruptas ou deploys iterativos (`51b43544`, `53feb397`).

### 3. 🧪 Qualidade de Código, CI/CD e Caracterização de UI
- **Testes no CI/CD (GitHub Actions) — Plano 002**:
  - Adição da verificação contínua e automatizada no CI (`.github/workflows/`), executando testes do frontend (`npm run frontend:test`), checagem de tipagem TypeScript (`typecheck`) e auditoria de segurança de dependências (`npm audit`) (`5310631d`).
- **Testes de Caracterização de Recorrência (`RecurrenceDisplay`) — Plano 004**:
  - Implementação de suíte abrangente de testes (`frontend/components/Task/__tests__/RecurrenceDisplay.test.tsx`) para o componente visual de recorrência antes de futuras refatorações (`61c36075`).
- **Correções de Linter & Documentação**:
  - Ajustes de regras ESLint em componentes críticos como `TaskItem.tsx` (`8bce179c`).
  - Atualização da documentação de testes e ganchos de *pre-push* (`docs/testing.md` / `feebf50b`).

### 4. 📋 Governança Arquitetural e Planos Executáveis por Agentes (`plans/`)
Este fork mantém uma pasta dedicada (`plans/`) de planos de trabalho executáveis por agentes de IA, com protocolo de execução autocontido:
- [plans/README.md](plans/README.md): ponto de entrada único — o prompt `read the @plans/README.md` basta para um agente listar os planos abertos, perguntar qual executar e rodá-lo fim a fim (baseline de testes, escopo fechado, um commit por item, marcação EXECUTADO).
- Planos executados permanecem como registro de decisão, com banner apontando o commit de implementação.
- **Fila vazia** desde 2026-07-17: todos os planos propostos foram executados. Trabalho novo entra como arquivo novo, com número novo.

### 5. 💾 Backup do Banco para o R2 (Disaster Recovery)
O banco é um arquivo SQLite num volume Docker — uma perda do host levaria tudo junto. Este fork adiciona snapshot offsite:
- **Snapshot consistente** via `VACUUM INTO` (seguro com o banco em uso, em WAL) e upload para o R2, em `backend/services/dbBackupService.js`.
- **Agendado por `node-cron`** (`TUDUDI_DB_BACKUP_CRON`, padrão 03:00), com retenção configurável (`TUDUDI_DB_BACKUP_RETENTION`, padrão 7 snapshots). Desligado por padrão (`TUDUDI_DB_BACKUP_ENABLED=false`).
- **Restore documentado e testado de verdade**, não só descrito: procedimento em [docs/backups.md](docs/backups.md).

### 6. 🎨 Branding Customizável por Instância
Nome exibido, logos (temas claro/escuro) e favicon configuráveis por admin, com fallback integral pro padrão tududi:
- Backend `backend/modules/branding/` (settings globais na tabela `settings`, endpoints públicos de leitura/asset + mutações admin-only, upload pelo pipeline R2).
- Frontend `BrandingContext` aplica título, favicon dinâmico e logos nas telas pré-login (Login/Register/OIDC) e navegação; aba Branding no Profile (admin).
- Traduções adicionadas nos 25 idiomas suportados.

### 7. ☁️ Suporte a Object Storage em Nuvem (Cloudflare R2 — `r2Service`)
Para ambientes conteinerizados ou de alta disponibilidade onde o armazenamento local efêmero em disco (`/app/uploads`) é um gargalo, este fork implementa suporte nativo a **Cloudflare R2 (Compatível com S3)**:
- **Centralização do Serviço (`backend/services/r2Service.js`)**: Gerenciamento unificado do cliente S3 (`@aws-sdk/client-s3`) e da *engine* `multer-s3`. Todos os fluxos de upload — anexos de tarefas (`attachments.js`), avatares de usuário (`profile/avatar`) e imagens de capa de projetos (`projects/routes.js`) — utilizam o mesmo serviço.
- **Resiliência e Inicialização *Lazy***: O *bucket* é resolvido de forma sob demanda via callback (`bucket: function (req, file, cb)`). Isso impede que a inicialização do Node.js/Docker trave no boot com erro `bucket is required` caso o R2 não esteja configurado, falhando de forma limpa apenas durante uma tentativa de upload se as credenciais estiverem ausentes (`ac6effcf`).
- **Interpolação no Docker Compose (`${R2_...:-}`)**: As variáveis de ambiente do R2 são declaradas com valores padrão flexíveis no `docker-compose.yml` (`R2_BUCKET=${R2_BUCKET:-}`), permitindo injeção limpa através do arquivo `.env` do host sem que valores vazios explícitos sobrescrevam o ambiente no container.
- **Paridade de Layout e Zero Migração de Dados**: As chaves dos objetos armazenadas no R2 (`tasks/task-123.pdf`, `avatars/avatar-456.jpg`) seguem exatamente a mesma estrutura dos basenames em disco local (`TaskAttachment.file_path`), dispensando qualquer migração de banco na transição entre disco local e nuvem (`2eddce66`).
- **Limpeza garantida de objetos órfãos**: deletar uma tarefa remove do bucket os anexos dela, das subtasks e das instâncias recorrentes futuras (`fe4e1651`); remover/trocar a capa de um projeto deleta o objeto antigo (`b707dce8`) — fluxos que antes deixavam lixo acumulando no R2.
- **Nomes canônicos de variáveis** `CLOUDFLARE_*` (`CLOUDFLARE_ACCOUNT_ID` monta o endpoint do R2), com fallback para os legados `R2_*` (`09aaa778`); setup de credenciais documentado em [`.env.example`](.env.example).
- **Regras de Lifecycle e Reconciliação**: Instruções para configurar regras de ciclo de vida no bucket R2 (abortar uploads multipartes incompletos) e realizar reconciliação de arquivos órfãos estão documentadas em [docs/15-storage.md](docs/15-storage.md).

---

## 🔄 Protocolo de Sincronização com a Upstream (`git-review.md`)

Para evitar que a evolução contínua do projeto original (`chrisvel/tududi`) sobrescreva as customizações, traduções PT-BR e correções de migração deste fork, seguimos o protocolo rigoroso definido em [`git-review.md`](git-review.md):
1. **Avaliação Commit a Commit**: Cada commit da upstream é inspecionado antes da mesclagem, decidindo entre *Apply* (aplicar direto), *Adapt* (adaptar mantendo código PT-BR/idempotente) ou *Skip* (ignorar se redundante/incompatível).
2. **Atualização Contínua deste `README.md`**: Sempre que uma sincronização ou revisão de pull request da upstream é finalizada, este `README.md` é mandatoriamente atualizado com os novos pontos de divergência e resumos de integração.

---

## 📜 Changelog Detalhado dos Commits Ahead de `chrisvel/tududi:main`

O repositório `luciancsilva/tasks:main` está **66 commits à frente** da branch original `chrisvel/tududi:main` (`upstream/main`), medido em 2026-07-17. Abaixo está a categorização técnica das mudanças exclusivas do fork — incluindo uma linha de trabalho que foi revertida, mantida aqui como registro:

### 🗄️ Cloudflare D1 — tentado e **revertido** (julho/2026)
Esta linha de trabalho **não existe mais no código**. Fica registrada porque os commits estão na história e porque a lição custou caro: o D1 faz 1 round-trip HTTP por statement (latência inviável) e a operação zerou o banco de produção duas vezes. O registro completo está em [`plans/09a-d1-code-removal.md`](plans/09a-d1-code-removal.md).
- **`5e705e8b`** (`feat(db): Cloudflare D1 data layer via REST API`): Driver sqlite3-compatível (`d1RestDriver.js`) plugado via `dialectModule` + client HTTP com retry, timeout e rate limiter.
- **`753b826a`** (`fix(db): D1 activation fixes from first real-world run`): PRAGMAs em minúsculas, carregamento do `.env` da raiz, trava que força SQLite local em `NODE_ENV=test`.
- **`09aaa778`** (`feat(config): unified CLOUDFLARE_* env var naming`): Nomes canônicos `CLOUDFLARE_*` com fallback dos legados. **A parte R2 sobreviveu à remoção do D1.**
- **`06b04667`** (`docs: add .env.example with Cloudflare token setup instructions`): Guia de obtenção/escopo de tokens.
- **Removido** em 2026-07-17 (`09a`, `09b`): driver, client, testes e documentação apagados. O banco é SQLite local, ponto.

### 💾 Backup do Banco para o R2 (julho/2026)
- **`0c9332b7`** (`feat(backup): snapshot the SQLite database to R2`): `VACUUM INTO` + upload, com retenção. Planos `10a`/`10b`.
- **`d21f8790`** (`feat(backup): schedule the database snapshot`): Agendamento via `node-cron` e env vars. Plano `10c`.
- **`3ef1c2cd`** (`docs(backups): document the R2 snapshot and its restore`): Restore **executado de verdade** e documentado. Plano `10d`.

### 🧹 Limpeza de Objetos R2 & Branding (julho/2026)
- **`fe4e1651`** (`fix(attachments): remove R2 objects when deleting a whole task`): Deleção de tarefa agora remove do bucket os anexos dela, das subtasks e das recorrências futuras; subtasks deixam de ficar órfãs no banco.
- **`b707dce8`** (`fix(projects): remove cover image object from R2 when cover is removed or replaced`): PATCH de capa limpa o objeto antigo; falhas de storage passam a ser logadas.
- **`887e4862`** (`feat(branding): instance-wide custom app name, logos and favicon`): Branding por instância (admin) com fallback pro padrão, endpoints públicos pré-login, upload via pipeline R2 e i18n nos 25 idiomas.
- **`f40acbe8`** (`refactor: defer R2 object deletion until after database transaction commits`): Adiamento da deleção física de arquivos do R2 para após o commit da transação do banco de dados, evitando perda de arquivos em caso de rollback. (ME-2)
- **`86edfbec`** (`style(branding): fix formatting and lint errors`): Ajustes e correções de formatação e linting nos arquivos e testes de branding.

### 🏗️ Governança, Compose & Higiene do Fork (julho/2026)
- **`44c0ba25`** (`chore(docker): compose file tailored to fork deployment plus D1 env block`): Compose buildando do fork no GitHub, env 100% interpolada do `.env`. O bloco D1 que este commit adicionou foi removido depois (`09a`).
- **`d553e1b7`** (`chore: remove upstream GitHub Pages site artifacts from fork`): Remoção de `index.html` (landing page), `CNAME`, `.nojekyll` e `screenshots/` — artefatos do site do upstream.
- **`e6de6648`**, **`e1624ee2`**, **`3fdb7911`**, **`b137dc93`**, **`b13d387b`** (`docs(plans)`): Workflow de planos executáveis por agentes — subplans por esforço (`05a/05b/05c`), plano de atualização do `/docs` (`06`), registro EXECUTADO dos planos implementados e ponto de entrada único (`read the @plans/README.md`).
- **`656bf687`** (`docs: refresh CLAUDE.md after July 2026 changes`): CLAUDE.md alinhado (R2, branding, plans).
- **`8f86039a`** (`refactor(tasks): extract controller and service from routes`): `routes.js` do módulo tasks de 1064 para 39 linhas. Plano `05c` HE-1.
- **`5565d758`** (`docs: align /docs with the current code`): Atualização integral do `/docs` contra o código, incluindo a correção do troubleshooting que mandava rodar `db:init` (o comando que zerou a produção). Plano `06`.
- **`8a620172`** (`feat(plans): implement 05a-quick-wins.md`): Implementação e validação de 5 melhorias rápidas de baixo esforço (limites de anexo, lifecycle de uploads órfãos do R2, drift i18n, etc.).
- **`bf7e99f0`** (`docs(plans): update plans status to EXECUTADO`): Atualização de status e documentação dos planos de esforço médio (ME-3 a ME-6) como concluídos.
- **`3741b706`** (`style: lint and formatting fixes on modified files`): Ajustes e correções de formatação e linting em arquivos e rotas refatoradas para conformidade com o linter no CI.
- **`0728a580`** (`fix(i18n): only fail check-i18n on Portuguese drift`): Ajuste no script de validação de tradução para falhar na build apenas se houver drift no idioma principal do fork (`pt`), emitindo apenas avisos para os demais 23 idiomas.

### ☁️ Storage em Nuvem & Resiliência Docker (Cloudflare R2)
- **`af2dd3e4`** (`fix(storage): lazy resolve R2 bucket and interpolate compose env vars`): Converte a propriedade `bucket` do `multer-s3` em função *lazy* (`(req, file, cb) => ...`), evitando crash `bucket is required` no boot da aplicação no Docker. Configura interpolação `${R2_...:-}` no `docker-compose.yml`.
- **`f93153cf`** (`feat(attachments): migrate file storage from local disk to Cloudflare R2`): Criação do `backend/services/r2Service.js` com `@aws-sdk/client-s3` e `multer-s3`. Substituição de `multer.diskStorage` por `multerS3` nos módulos de anexos de tarefas (`attachments.js`), avatares de usuário (`users/routes.js`) e imagens de projeto (`projects/routes.js`).

### 🌐 Localização PT-BR Integral & Tradução de Interface
- **`350ddeb7`** (`fix(i18n): add missing translation keys referenced in code`): Adição de chaves de tradução em português (`pt/translation.json`) e inglês para termos referenciados dinamicamente nos componentes React.
- **`192cbda2`** (`feat(i18n): translate remaining English UI and utils text to pt-BR`): Tradução final de textos em inglês em modais, filtros e utilitários de formatação de strings para o Português do Brasil.
- **`01de94b5`** (`fix(i18n): correct pt-BR task screen issues (attachments key, Assigned To, date casing)`): Correção na tela de detalhes da tarefa: mapeamento correto da chave do card de anexos (`TaskAttachmentsCard`), rótulo "Atribuído a" e padronização da capitalização de meses/dias da semana.
- **`bc7229ee`** (`feat(i18n): complete pt-BR localization of remaining frontend UI`): Expansão da cobertura de localização PT-BR para telas secundárias e modais de configuração do frontend React.
- **`6febc958`** (`fix(i18n): fill missing pt-BR keys and fix all-caps sidebar labels`): Preenchimento de chaves PT-BR pendentes e remoção da transformação *ALL CAPS* forçada nos rótulos de navegação da barra lateral (*Sidebar*).
- **`18e8a171`** (`fix(i18n): correct pt-BR translation errors and standardize casing`): Revisão ortográfica, gramatical e padronização visual de maiúsculas/minúsculas em todo o dicionário PT-BR.
- **`402ccc68`** (`feat(i18n): localize date formatting to Portuguese across Today and Calendar views, and add missing Today gear settings translations`): Adaptação dos formatadores nativos de data para o padrão brasileiro (`pt-BR`) nas visualizações *Hoje* e *Calendário*, e tradução das opções no menu da engrenagem.
- **`16eb116f`** (`feat(telegram): add Portuguese localization for Telegram bot commands, notifications, and task summaries`): Tradução e adaptação de 100% dos comandos interativos do bot do Telegram (`/start`, `/tasks`, etc.), alertas push e resumos de tarefas (`daily digests`).
- **`67f3762e`** (`feat(i18n): localize Habits and People modules for Portuguese (PT)`): Localização integral das interfaces e modais dos módulos de Hábitos (*Habits*) e Pessoas (*People*).
- **`f071873c`** (`i18n: fill in missing PT translations`): Carga inicial e mapeamento de chaves no dicionário `translation.json` em português.

### 🛡️ Idempotência de Banco (Migrations), Autenticação & CI/CD
- **`a598aa3e`** (`fix(auth): make isAdmin resolve users by numeric id or uid (#1)`): Refatoração crítica em `isAdmin()` para comparar IDs numéricos relacionais e strings UUID (`uid`), corrigindo falhas de permissão ao autenticar via OIDC/SSO e na execução de testes.
- **`53feb397`** (`fix(migrations): make add-people-to-tasks and add-color-to-people idempotent`): Adição de verificações defensivas (*check-and-add*) nas migrações de *People* e *Colors* do Sequelize para impedir erros de SQL e travamento de contêineres em reinicializações do Docker.
- **`51b43544`** (`fix(migrations): make add-goal-columns-to-projects idempotent`): Transformação da migração de colunas de metas dos projetos em operação idempotente segura em re-execuções.
- **`36fe379a`** (`fix(tests): prevent test-created users from silently becoming admin`): Blindagem na suíte de testes de autenticação para impedir que usuários temporários ganhem privilégios de administrador de forma silenciosa.
- **`5310631d`** (`ci: run frontend tests, typecheck, and npm audit (#2)`): Criação do *workflow* no GitHub Actions para validação automatizada de testes do frontend, verificação de tipagem TypeScript e auditoria de vulnerabilidades (`npm audit`).
- **`1a095535`** (`refactor: eliminate PRAGMA foreign_keys = OFF global on task delete`): Eliminação de comando PRAGMA global que desligava foreign keys para a sessão inteira do SQLite, garantindo isolamento entre conexões e segurança nas cascatas. (ME-1)
- **`e1738ce2`** (`refactor(database): remove BaseRepository and implement native cascade deletes`): Remoção completa da classe BaseRepository. Todos os 13 repositórios foram convertidos em classes planas autônomas. Configuração de cascade nativa no banco para tabelas dependentes de tarefas. (ME-3, ME-5)

### 🎨 Estabilidade UI/UX & Testes de Caracterização
- **`61c36075`** (`test(frontend): add characterization tests for RecurrenceDisplay`): Implementação de suíte abrangente de testes de caracterização para blindar a lógica de exibição de tarefas recorrentes (`RecurrenceDisplay.test.tsx`).
- **`989d2fe0`** (`fix(lint): restore eslint-disable coverage for unused destructure in TaskItem`): Correção de aviso de linter TypeScript/ESLint referente a desestruturação não utilizada no componente `TaskItem.tsx`.

### 📚 Governança do Fork, Documentação & Sincronização Upstream
- **`d038ebc6`** (`Merge upstream/main (v1.2.4) into fork`): Mesclagem de sincronização trazendo todas as melhorias e correções da versão `v1.2.4` da upstream `chrisvel/tududi`.
- **`a11fa2dc`** (`merge: integrate upstream changes up to v1.2.3 (#1268, #1269)`): Integração autônoma das PRs `#1268` e `#1269` e consolidação com a versão `v1.2.3` da upstream.
- **`1316a2e0`** (`docs: replace env variables with static example values in README docker compose snippet`): Substituição de placeholders de variáveis genéricas por valores estáticos de exemplo no snippet de Docker Compose do `README.md`.
- **`b46a04ff`** (`docs: update README with docker compose and configure local docker-compose.yml`): Atualização do guia rápido de instalação e configuração do `docker-compose.yml` local.
- **`cc5cb740`** (`docs: correct Docker setup steps in README`): Correção e refinamento do passo a passo para deploy conteinerizado via Docker.
- **`dec60bd3`** (`docs: update git-review workflow and rewrite README with fork differences`): Reestruturação completa do `README.md` apresentando as customizações exclusivas do fork e criação das diretrizes do `git-review.md`.
- **`feebf50b`** (`docs: correct stale testing docs (#3)`): Atualização da documentação sobre execução de testes unitários e configuração de ganchos de pré-push no repositório.

---

## 🚀 Como Executar o Projeto Funcional

### Execução via Docker Compose (Recomendado)
Para iniciar rapidamente a instância do fork em português usando Docker Compose (incluindo suporte opcional a Cloudflare R2), configure seu arquivo `docker-compose.yml` da seguinte forma:

```yaml
services:
  tududi:
    container_name: tududi
    build:
      context: https://github.com/luciancsilva/tasks.git#main
      dockerfile: Dockerfile
    restart: unless-stopped

    ports:
      - "3002:3002"

    environment:
      TUDUDI_USER_EMAIL: admin@exemplo.com.br
      TUDUDI_USER_PASSWORD: senha-segura-aqui
      TUDUDI_SESSION_SECRET: changeme-please-use-openssl
      TUDUDI_ALLOWED_ORIGINS: http://localhost:3002
      TUDUDI_TRUST_PROXY: "true"
      TZ: America/Sao_Paulo
      # Cloudflare — conta usada pelo R2 (nomes legados R2_* seguem funcionando
      # como fallback):
      CLOUDFLARE_ACCOUNT_ID: ${CLOUDFLARE_ACCOUNT_ID:-}
      # Cloudflare R2 (Opcionais - Se configuradas, uploads vão para o R2 em vez do disco local):
      CLOUDFLARE_R2_ACCESS_KEY_ID: ${CLOUDFLARE_R2_ACCESS_KEY_ID:-}
      CLOUDFLARE_R2_SECRET_ACCESS_KEY: ${CLOUDFLARE_R2_SECRET_ACCESS_KEY:-}
      CLOUDFLARE_R2_BUCKET: ${CLOUDFLARE_R2_BUCKET:-}
      CLOUDFLARE_R2_ENDPOINT: ${CLOUDFLARE_R2_ENDPOINT:-}
      # Backup lógico (precisa cair num volume persistente):
      TUDUDI_BACKUP_PATH: ${TUDUDI_BACKUP_PATH:-/app/db/backups}
      # Snapshot do banco para o R2 (disaster recovery) — ver docs/backups.md:
      TUDUDI_DB_BACKUP_ENABLED: ${TUDUDI_DB_BACKUP_ENABLED:-false}
      TUDUDI_DB_BACKUP_CRON: ${TUDUDI_DB_BACKUP_CRON:-0 3 * * *}
      TUDUDI_DB_BACKUP_RETENTION: ${TUDUDI_DB_BACKUP_RETENTION:-7}

#    user: "1001:1001"

    # Caminhos definidos no Dockerfile (VOLUME/DB_FILE/TUDUDI_UPLOAD_PATH).
    # Montar em /app/backend/db como nas versões < v1.2.0 deixa o banco num
    # volume anônimo, que o Docker descarta a cada recriação do container.
    volumes:
      - tududi_db:/app/db
      - tududi_uploads:/app/uploads

volumes:
  tududi_db:
  tududi_uploads:
```

Acesse **http://localhost:3002** para utilizar o sistema.

> O `docker-compose.yml` versionado neste repo builda de
> `context: https://github.com/luciancsilva/tasks.git#main` — ou seja, sobe a
> `main` do GitHub, **não** o seu working tree. Para testar mudança local, use
> `npm start`.

### Desenvolvimento Local (Modo Código Fonte)
```bash
# 1. Clonar o repositório do fork
git clone git@github.com:luciancsilva/tasks.git
cd tasks

# 2. Instalar todas as dependências (Backend + Frontend)
npm install

# 3. Subir os dois servidores de uma vez
npm start             # frontend :8080, backend :3002

# ...ou separadamente:
npm run backend:dev   # Terminal 1 — API Node.js na porta 3002
npm run frontend:dev  # Terminal 2 — React/webpack-dev-server na porta 8080
```

> ⚠️ **`npm run db:init` e `npm run db:reset` destroem o banco** — são
> `sequelize.sync({ force: true })`. Não são comandos de setup. Para inspecionar
> o banco use `npm run db:status`.

---

## 📚 Documentação Adicional do Repositório

* [CLAUDE.md](CLAUDE.md) — Guia de arquitetura e padrões do codebase; índice de todo o `/docs`.
* [git-review.md](git-review.md) — Diretrizes de manutenção de fork e regras de integração upstream.
* [plans/README.md](plans/README.md) — Planos executáveis por agentes, armadilhas do repo e status de execução.
* [docs/backups.md](docs/backups.md) — Backup do banco e procedimento de restore.
* [docs/15-storage.md](docs/15-storage.md) — Object storage no Cloudflare R2.
* [docs/16-branding.md](docs/16-branding.md) — Branding customizável por instância.
* [docs/MEMORY.md](docs/MEMORY.md) — Memória técnica do repositório e contexto do sistema.
