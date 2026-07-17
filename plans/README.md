# /plans — planos de trabalho executáveis por agentes

Diretório de planos de implementação deste fork. Serve tanto para humanos quanto
para agentes de IA (Claude Code, etc.) que forem executar trabalho aqui.

Os planos são escritos para serem executados **por um agente que não conhece o
repo**. Cada um traz seu próprio contexto, referências `arquivo:linha` e critério
de pronto. Este README traz o que vale para todos.

## Instruções ao agente — COMECE AQUI

**Ler este arquivo É a instrução de trabalho.** Se o usuário só mandou
"read the @plans/README.md" (ou equivalente), não espere mais contexto:
siga os passos abaixo imediatamente.

1. Leia este arquivo inteiro e o `CLAUDE.md` da raiz.
2. Liste ao usuário os planos **Abertos** (tabelas abaixo) com uma linha de
   descrição cada e **pergunte em qual plano vai trabalhar** — não escolha
   sozinho. Se o usuário já nomeou o plano, pule esta etapa.
3. Confirme as **dependências** do plano escolhido (coluna "Depende de"). Plano
   com dependência aberta não deve ser executado antes dela.
4. Execute o plano do início ao fim **sem pausar para pedir aprovação entre
   etapas**: baseline de testes → implementação → testes/lint → commit citando o
   plano → marcar EXECUTADO e atualizar as tabelas deste README.
5. Só interrompa por decisão que apenas o dono do repositório pode tomar
   (credencial, escolha de produto, mudança de API pública).
6. Ao final, entregue resumo: o que foi feito, resultado dos testes, desvios.

## Armadilhas

⚠️ **Leia antes de rodar qualquer comando.** Cada uma destas já causou estrago
real ou daria falso positivo. Esta seção é a **fonte única** — `CLAUDE.md` e
`docs/MEMORY.md` apontam para cá em vez de duplicar.

1. **`npm run db:init` e `npm run db:reset` DESTROEM o banco.** São
   `sequelize.sync({ force: true })` = DROP de todas as tabelas. Foi exatamente
   esse comando, disparado automaticamente no boot, que zerou o banco de
   produção duas vezes em 2026-07-16/17 (`09a-d1-code-removal.md` §Registro).
   **Como agente executor, você nunca precisa rodar nenhum dos dois**: o banco
   de dev já existe neste checkout, e a suíte usa `NODE_ENV=test`. Para
   inspecionar, `npm run db:status` (só lê).

   Nuance que não cabe esquecer: num banco que **ainda não existe**, `db:init` é
   o caminho *correto* — é o que `backend/cmd/start.sh:92` faz. `db:migrate`
   sozinho não bootstrapa: a ordem alfabética roda
   `20250116...-add-first-day-of-week-to-users` antes de `20250615...-create-users`,
   `safeAddColumns` pula em silêncio e marca a migration como executada — a
   coluna nunca é criada. O perigo do `db:init` é exclusivamente contra banco que
   **já existe**.
2. **`docker compose up --build` NÃO testa seu código local.** O
   `docker-compose.yml` builda de
   `context: https://github.com/luciancsilva/tasks.git#main` — ou seja, o
   container roda a `main` do GitHub, não o working tree. Smoke test de mudança
   local é com `npm start` (frontend :8080, backend :3002). Só use o compose para
   validar algo que já está na `main`.
3. **`NODE_ENV=test` é o único seguro por construção.** Comando com
   `NODE_ENV=development|production` toca o banco real do checkout. A suíte Jest
   pode rodar à vontade.
4. **Nunca commitar segredo.** `.env` e `AGENTS.md` são gitignored (AGENTS.md
   existe só neste checkout). Se um plano pedir mudança no `.env`, avise o dono —
   não tente versionar.
5. **Não faça `git push` sem autorização explícita** do dono. Commit local sim,
   push não. A `main` é o que o Docker builda: publicar ali afeta o ambiente dele.

## Comandos

Da **raiz** do repo:

```bash
npm run backend:test          # suíte backend inteira (NODE_ENV=test)
npm run backend:test:unit     # só tests/unit
npm run frontend:test         # suíte frontend
npm run db:status             # inspecionar o banco (seguro, só lê)
npm start                     # sobe a app local: frontend :8080, backend :3002
```

De dentro de `backend/` (para o que é pontual):

```bash
npx cross-env NODE_ENV=test npx jest tests/unit/foo.test.js   # um arquivo de teste
npx eslint caminho/do/arquivo.js                              # lint de um arquivo
npx eslint --fix caminho/do/arquivo.js                        # corrige formatação
```

**Não rode `npm run backend:lint` (lint global)**: em checkout Windows ele falha
com milhares de `Delete ␍` (CRLF) — ruído pré-existente, não é seu bug. Linte
só os arquivos que você tocou, individualmente.

## Racional

- **Um plano = uma unidade de trabalho commitável.** Cada arquivo descreve algo
  que pode ser implementado, testado e commitado de forma independente. Planos
  grandes são quebrados em menores (`10a`, `10b`, ...) para que cada pedaço seja
  executável isoladamente.
- **Planos citam código real** (`arquivo:linha`), nunca generalidades — o agente
  executor não deve precisar re-investigar o que o plano já investigou, apenas
  validar que as referências continuam verdadeiras.
- **Ciclo de vida**: proposto → executado → **marcado como EXECUTADO** (banner
  no topo) e mantido como registro de decisão. Saem do diretório: planos
  descartados, consumidos sem valor de registro (ex.: prompts de planejamento) e
  **planos de tecnologia removida do código** — nesse caso a história e a decisão
  ficam registradas no plano de remoção (exceção aplicada em 2026-07-17 ao
  remover o Cloudflare D1, ver `09a`).
- **Numeração**: o prefixo `NN-` é **identidade, não posição** — mensagens de
  commit citam o plano pelo número ("Implements plans/05b ME-1"), então um número
  aponta para sempre ao mesmo trabalho. **Números não são reciclados**: buracos
  na sequência (hoje 04, 07, 08) são planos removidos, e reusá-los faria um
  commit antigo apontar para o plano errado. Sufixos de letra agrupam
  segregações de um mesmo trabalho. **A ordem de execução é a das tabelas
  abaixo, não a do número.**

## Estado atual

**Prioridade** é risco, não gosto:
- **Alta** — risco de perda de dados ou de indisponibilidade.
- **Média** — dívida que já causou incidente, ou que bloqueia trabalho futuro.
- **Baixa** — qualidade e consistência, sem risco imediato.

Dentro de cada prioridade, do menor para o maior esforço.

### Prioridade ALTA

| Esforço | Arquivo | O quê | Depende de |
|---|---|---|---|
| Baixo | `19l-caldav-delete-missing-method.md` | `SyncStateRepository.deleteByTaskId` não existe — sync de deleção CalDAV lança `TypeError` em runtime (merge/push-phase) | - |
| Baixo | `20-caldav-delete-by-calendar-id-broken-method.md` | `SyncStateRepository.deleteByCalendarId` chama `this.delete`, método que não existe (só `destroy`) — `TypeError` ao deletar calendário CalDAV | - |

### Prioridade MÉDIA

| Esforço | Arquivo | O quê | Depende de |
|---|---|---|---|
| Baixo | `19m-backup-tag-name-collision.md` | Restore de backup entre usuários colide em `UNIQUE(user_id, name)` de tags e aborta a restauração inteira | - |
| Baixo | `21-inbox-mention-cleanup-ascii-regex.md` | `@pessoa` acentuada deixa resto no título ao criar tarefa/nota pelo Inbox (fallback de limpeza usa regex ASCII-only) | - |

### Prioridade BAIXA

| Esforço | Arquivo | O quê | Depende de |
|---|---|---|---|
| Baixo | `19n-flaky-subtasks-completion.md` | `subtasks-completion.test.js` falhou 1x sob execução paralela (passa isolado/re-run) — flake a estabilizar | - |

`05-future-improvements.md` é o índice do levantamento que gerou os `05x` — é
registro, não trabalho.

Os riscos que ocupavam a faixa ALTA foram fechados em 2026-07-17: a ausência de
backup offsite pelos `10a`–`10d` (snapshot pro R2, agendado, restore executado),
e a camada D1 morta pelos `09a`/`09b`.

### Executados — registro de decisão, não mexer

| Arquivo | O quê | Status |
|---|---|---|
| `22-frontend-jest-esm-transform-remark-breaks.md` | Baseline `frontend:test` vermelha: `remark-breaks` (ESM) quebra o Jest, sem mudança de código | EXECUTADO (2026-07-17) |
| `01-r2-cover-cleanup.md` | Capa de projeto órfã no R2 | EXECUTADO (`b707dce`) |
| `02-r2-task-cleanup.md` | Anexos órfãos ao deletar tarefa | EXECUTADO (`fe4e165`) |
| `03-branding-customization.md` | Logo/favicon/nome customizáveis | EXECUTADO (`887e486`) |
| `05a-quick-wins.md` | 5 itens de esforço baixo | EXECUTADO (2026-07-16) |
| `05b-medium-effort.md` | 4 itens de esforço médio | EXECUTADO (2026-07-16) |
| `09a-d1-code-removal.md` | Remoção da camada de dados D1 (código) | EXECUTADO (2026-07-17) |
| `09b-d1-docs-cleanup.md` | Tirar D1 da documentação | EXECUTADO (2026-07-17) |
| `11-backup-dir-volume.md` | Backup lógico em diretório persistente | EXECUTADO (2026-07-17) |
| `10a-r2-put-and-list.md` | Funções putObjectFromFile e listObjects no r2Service | EXECUTADO (2026-07-17) |
| `10b-db-snapshot-service.md` | createSnapshot(): VACUUM INTO + upload R2 + retenção | EXECUTADO (2026-07-17) |
| `10c-backup-scheduler.md` | Agendar o snapshot (node-cron) + env vars | EXECUTADO (2026-07-17) |
| `10d-backup-restore-docs.md` | Executar um restore de verdade e documentá-lo | EXECUTADO (2026-07-17) |
| `06-docs-update.md` | Atualização integral do `/docs` | EXECUTADO (2026-07-17) |
| `05c-high-effort.md` | HE-1 controller/service em tasks; HE-2 testes de BrandingTab e do guarda de avatar | EXECUTADO (2026-07-17) |
| `13-db-init-guard.md` | Guarda genérica contra `db:init` em banco existente | EXECUTADO (2026-07-17) |
| `14a-mcp-delete-task-seguro.md` | MCP `delete_task` orfana anexos no R2 e apaga histórico de recorrência | EXECUTADO (2026-07-17) |
| `14b-mcp-status-e-datas.md` | MCP: corrigir enum de status (archived≠6), expor `waiting` e filtrar datas de verdade | EXECUTADO (2026-07-17) |
| `14c-mcp-doc-e-registry.md` | Doc do MCP (16→44 tools) e `listMcpTools` derivado do registry | EXECUTADO (2026-07-17) |
| `12-migration-bootstrap-order.md` | Migration fora de ordem faz o bootstrap por migrations gerar schema quebrado em silêncio | EXECUTADO (2026-07-17) |
| `19k-windows-tests-and-fixtures.md` | AB-1/AB-2: baseline de testes (execSync no Windows, mock parsed_people) | EXECUTADO (2026-07-17) |
| `15-backup-prune-por-ambiente.md` | Retenção de snapshot mistura ambientes no prune | EXECUTADO (2026-07-17) |
| `18-skill-tududi-mcp.md` | Manutenção da skill `skills/tududi-mcp` após 14a/14b | EXECUTADO (2026-07-17) |
| `16-views-gtd-status-pessoa.md` | Views por status de tarefa (waiting) e por pessoa — "Aguardando"/"Delegadas" | EXECUTADO (2026-07-17) |
| `17-guia-setup-gtd.md` | Guia de setup GTD (mapeamento TickTick → tududi) | EXECUTADO (2026-07-17, branch `feat/16-views-gtd`) |
| `19c-r2-deep-subtasks-cascade.md` | AL-3: deleteWithOrphaning coleta subtarefas profundas (nível 3+) p/ R2 | EXECUTADO (2026-07-17) |
| `19f-project-sharing-deadlock-fix.md` | AL-7: propaga ctx.tx em collectProjectDescendants (evita SQLITE_BUSY no share) | EXECUTADO (2026-07-17) |
| `19g-backend-pagination-max-limit.md` | AM-4: teto MAX_LIMIT=100 em notifications/inbox/events | EXECUTADO (2026-07-17) |
| `19j-frontend-null-safety-subtasks.md` | AM-8: null-safety em fetchSubtasks/loadSubtasks (evita crash de UI) | EXECUTADO (2026-07-17) |
| `19h-frontend-race-conditions.md` | AM-1/5/7: isMounted/AbortController em ProjectDetails, ViewDetail, ProfileSettings | EXECUTADO (2026-07-17) |
| `19i-frontend-memory-leaks.md` | AM-2/3/6: clearTimeout em usePersistedModal, AreaModal, ProfileSettings | EXECUTADO (2026-07-17) |
| `19a-tasks-transactions.md` | AL-1: create/update de tasks atômicos (sequelize.transaction) propagada a tags/people/subtasks/parent-child | EXECUTADO (2026-07-17) |
| `19e-projects-transactions-and-tags.md` | AL-5: create/update de projects atômicos + erro de tag deixa de ser engolido | EXECUTADO (2026-07-17) |
| `19d-caldav-sync-batching-and-tx.md` | AL-4/AL-6: pull-phase em lotes paralelos + merge-phase create/update transacionais | EXECUTADO (2026-07-17) |
| `19b-backup-restore-mentions.md` | AL-2: backup/restore inclui Person + @mentions e resolve FKs por UID | EXECUTADO (2026-07-17) |

## Regras para o agente executor

1. **Antes de começar**: ler `CLAUDE.md` e o plano inteiro. Validar as
   referências `arquivo:linha` do plano contra o código atual — elas envelhecem.
   Se divergirem muito, **atualizar o plano antes de implementar** e dizer isso
   no resumo.
2. **Baseline**: rodar `npm run backend:test` **antes** de qualquer mudança e
   registrar o resultado. Suíte vermelha na baseline = parar e reportar; não é
   você que quebrou.
3. **Escopo**: implementar somente o que o plano descreve. Descoberta nova no
   caminho vira **plano novo**, não scope creep — e nunca item novo em plano já
   EXECUTADO, que o reabriria.
4. **Testes**: toda mudança de comportamento ganha teste seguindo os padrões
   existentes (`backend/tests/integration/`, mock R2 via `aws-sdk-client-mock`,
   ver `task-attachments.test.js`). Suíte completa + lint dos arquivos tocados
   antes do commit.
5. **Commit**: um commit por plano, mensagem convencional
   (`fix:`/`feat:`/`refactor:`/`docs:`), corpo citando o plano (ex.: "Implements
   plans/10a"). Sem emojis, sem `Co-authored-by` (preferências em
   `docs/MEMORY.md`). **Commit sim, push não** — ver Armadilhas.
6. **Branch**: cada plano declara no banner onde trabalhar. Regra geral:
   **correção e documentação vão direto na `main`** (local; push continua
   proibido sem autorização); **feature nova vai em branch própria**
   (`feat/NN-...`), criada a partir da `main`, **sem merge** — o dono valida a
   feature na branch e decide se mantém. Motivo: o Docker builda da `main` do
   GitHub, então a `main` precisa estar sempre em estado pushável; feature
   não validada não pode ficar no caminho de um push urgente de correção.
   Plano sem indicação de branch = `main` direto.
7. **Encerramento**, no mesmo commit:
   - banner no topo do plano, neste formato:
     ```
     > **Status: EXECUTADO** em AAAA-MM-DD — <o que foi feito, 1-2 linhas>.
     ```
   - mover a linha do plano para a tabela "Executados" deste README;
   - se o plano tinha itens e sobrou algum, remover só os itens feitos.
8. **Bloqueio**: só interromper por decisão que exige o dono do repositório
   (credencial, escolha de produto, mudança de API pública). O resto: decidir
   pelo padrão já documentado e registrar o desvio no commit/resumo.

## Contexto permanente

- **O banco é SQLite local**: `/app/db/production.sqlite3` no container, via
  volume `tududi_db`. Em dev, `backend/db/development.sqlite3`. Roda em WAL.
- **Cloudflare R2** guarda anexos, avatares, capas e branding
  (`backend/services/r2Service.js`). **`CLOUDFLARE_ACCOUNT_ID` é usada pelo R2**
  para montar o endpoint.
- **O Cloudflare D1 foi tentado e removido** em 2026-07-17 (`09a`): latência
  inviável (1 round-trip HTTP por statement) e wipe recorrente do banco. Código
  do driver apagado; o §Registro no `09a` preserva a história e a lição.
- **Lição que custou caro**: nunca decidir *"o banco existe?"* por artefato local
  (arquivo, volume, path) se o banco for remoto — nenhum deles descreve um banco
  remoto. Foi essa confusão que zerou a produção duas vezes.
- Env vars Cloudflare: nomes canônicos `CLOUDFLARE_*` (legados `R2_*` aceitos
  como fallback); setup documentado em `.env.example`.
- `docs/MEMORY.md` guarda preferências de PR/commit/testes do repositório.
