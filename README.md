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

### 4. 📋 Governança Arquitetural e Planos de Melhoria (`plans/`)
Este fork mantém uma pasta dedicada (`plans/`) com o mapeamento técnico completo (gerado via auditoria de arquitetura `improve`), categorizando pendências técnicas e roteiro de execução para agentes de IA e desenvolvedores:
- [plans/README.md](plans/README.md): Matriz de prioridades e status das correções técnicas.
- Planos mapeados para execução (Plano 008 a 012):
  - **Plano 008**: Proteção de autenticação na montagem estática de arquivos `/api/uploads`.
  - **Plano 009**: Correção do relink de chave estrangeira (FK) de anexos na restauração de backups.
  - **Plano 010 & 012**: Validações de propriedade de projeto/área nas ferramentas MCP (`create_task`, `list_tasks`).
  - **Plano 011**: Otimização de performance no *hot-path* das tarefas recorrentes e remoção de logs redundantes.

---

## 🔄 Protocolo de Sincronização com a Upstream (`git-review.md`)

Para evitar que a evolução contínua do projeto original (`chrisvel/tududi`) sobrescreva as customizações, traduções PT-BR e correções de migração deste fork, seguimos o protocolo rigoroso definido em [`git-review.md`](git-review.md):
1. **Avaliação Commit a Commit**: Cada commit da upstream é inspecionado antes da mesclagem, decidindo entre *Apply* (aplicar direto), *Adapt* (adaptar mantendo código PT-BR/idempotente) ou *Skip* (ignorar se redundante/incompatível).
2. **Atualização Contínua deste `README.md`**: Sempre que uma sincronização ou revisão de pull request da upstream é finalizada, este `README.md` é mandatoriamente atualizado com os novos pontos de divergência e resumos de integração.

---

## 🚀 Como Executar o Projeto Funcional

### Execução via Docker (Ambiente Prontamente Funcional)
Para iniciar rapidamente a instância do fork em português com persistência de banco de dados e anexos:

```bash
# 1. Construir a imagem Docker a partir do código deste fork:
docker build -t tududi-ptbr:local .

# 2. Executar o contêiner usando a imagem local construída:
docker run \
  -e TUDUDI_USER_EMAIL=admin@exemplo.com.br \
  -e TUDUDI_USER_PASSWORD=senha-segura-aqui \
  -e TUDUDI_SESSION_SECRET=$(openssl rand -hex 64) \
  -e TUDUDI_TRUST_PROXY=true \
  -v ~/tududi_db:/app/db \
  -v ~/tududi_uploads:/app/uploads \
  -p 3002:3002 \
  -d tududi-ptbr:local
```
Acesse **http://localhost:3002** para utilizar o sistema.

### Desenvolvimento Local (Modo Código Fonte)
```bash
# 1. Clonar o repositório do fork
git clone git@github.com:luciancsilva/tasks.git
cd tasks

# 2. Instalar todas as dependências (Backend + Frontend)
npm install

# 3. Executar servidores de desenvolvimento
npm run backend:dev   # Terminal 1 — API Node.js rodando na porta 3001
npm run frontend:dev  # Terminal 2 — React/Vite rodando na porta 8080
```

---

## 📚 Documentação Adicional do Repositório

* [git-review.md](git-review.md) — Diretrizes de manutenção de fork e regras de integração upstream.
* [plans/README.md](plans/README.md) — Roteiro de melhorias arquiteturais e status de execução.
* [docs/MEMORY.md](docs/MEMORY.md) — Memória técnica do repositório e contexto do sistema.
