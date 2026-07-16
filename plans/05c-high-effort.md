# 05c — Melhorias de esforço ALTO (estruturais)

Origem: itens do levantamento `05-future-improvements.md`, segregados por esforço.
Itens desta faixa são refatorações estruturais ou trabalho contínuo — quebrar em
etapas com commits intermediários e suíte verde a cada etapa. Regras: `plans/README.md`.

---

## HE-1. Extrair service/controller do módulo tasks

- **Onde**: `backend/modules/tasks/routes.js` (~1000 linhas com lógica de negócio
  inline: delete com recorrência, SQL cru em `tasks_tags`, serialização, métricas).
- **Por quê (alta prioridade)**: é o módulo mais crítico e o único fora do padrão
  controller→service→repository usado em projects/areas/goals; os bugs das
  limpezas de R2 nasceram aqui.
- **Como (etapas)**:
  1. Criar `tasks/controller.js` + `tasks/service.js` vazios seguindo o molde de
     `backend/modules/projects/`.
  2. Migrar um endpoint por vez (começar pelos simples: GET subtasks, GET metrics),
     rodando a suíte a cada migração.
  3. Delete e update (com recorrência) por último — extrair para
     `tasks/operations/` o que for regra de negócio pura.
  4. `routes.js` final: só definição de rotas + middlewares.
- **Critério de pronto**: `routes.js` < 200 linhas; nenhum acesso direto a model
  nas rotas; suíte integral verde sem mudança de contrato HTTP.
- **Esforço**: alto (várias sessões). **Dependência**: absorve ME-1/ME-4 se feitos juntos.

## HE-2. Cobertura de testes do frontend em fluxos críticos

- **Onde**: `frontend/__tests__/` (hoje 4 suítes / 65 testes) vs superfície real
  (ProfileSettings ~1500 linhas, fluxos de upload, branding, views).
- **Por quê**: regressões de UI só aparecem no E2E Playwright (lento, não roda em
  cada PR localmente).
- **Como (incremental, sem big-bang)**:
  1. Definir alvo: componentes com lógica condicional de dados (BrandingTab,
     GeneralTab avatar, TaskDetails attachments, ProjectDetails capa).
  2. Testing Library + mock de fetch (padrão já usado nas suítes existentes).
  3. Meta inicial: +1 suíte por PR que tocar componente sem teste (regra de
     revisão), não uma força-tarefa.
- **Esforço**: alto/contínuo.

## HE-3. Consolidação pós-D1: transação de verdade nos fluxos compostos

- **Onde**: fluxos multi-statement (delete de projeto, delete de tarefa, admin
  cascade) sob `TUDUDI_DB_DRIVER=d1`.
- **Por quê**: driver D1 REST neutraliza BEGIN/COMMIT (documentado em
  `04-d1-migration.md` §9, hoje aceito); fluxos compostos podem parar no meio.
- **Como (opções a avaliar quando o modo D1 virar produção de fato)**:
  a. Reescrever fluxos compostos como **batch** de statements numa única chamada
     REST (D1 executa lote atomicamente) — exige API própria no driver
     (`d1Client.batch(sqlStatements)`) e refatorar os fluxos para SQL explícito.
  b. Compensação: ordem de operações idempotente + retomada (job de limpeza).
  c. Aceitar e monitorar (estado atual).
- **Recomendação**: (a) para os 3 fluxos de delete; mantém o resto no driver comum.
- **Esforço**: alto. **Dependência**: ME-1 (ordem de deleção explícita) simplifica muito.
