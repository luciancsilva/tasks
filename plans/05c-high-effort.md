# 05c — Melhorias de esforço ALTO (estruturais)

Origem: itens do levantamento `05-future-improvements.md`, segregados por esforço.
Itens desta faixa são refatorações estruturais ou trabalho contínuo — quebrar em
etapas com commits intermediários e suíte verde a cada etapa. Regras: `plans/README.md`.

> **HE-1 EXECUTADO** em 2026-07-17 — `routes.js` do módulo tasks reduzido de 1064
> para 39 linhas via `controller.js` + `service.js`. Item removido deste plano.

---

## HE-2. Cobertura de testes do frontend em fluxos críticos

- **Onde**: as suítes de frontend são **colocadas**, não centralizadas —
  `frontend/components/Shared/__tests__/MarkdownRenderer.checkbox.test.tsx`,
  `frontend/components/Task/TaskDetails/__tests__/TaskContentCard.test.tsx`,
  `frontend/components/Task/__tests__/RecurrenceDisplay.test.tsx` e
  `frontend/utils/dateUtils.test.ts` (4 suítes no total). `frontend/__tests__/`
  só contém `setup.ts`. Superfície real muito maior: ProfileSettings ~1500
  linhas, fluxos de upload, branding, views.
- **Por quê**: regressões de UI só aparecem no E2E Playwright (lento, não roda em
  cada PR localmente).
- **Como (incremental, sem big-bang)**:
  1. Definir alvo: componentes com lógica condicional de dados (BrandingTab,
     GeneralTab avatar, TaskDetails attachments, ProjectDetails capa).
  2. Testing Library + mock de fetch (padrão já usado nas suítes existentes).
  3. Meta inicial: +1 suíte por PR que tocar componente sem teste (regra de
     revisão), não uma força-tarefa.
- **Esforço**: alto/contínuo.
- **Nota**: HE-2 é uma **regra de revisão contínua**, não uma unidade de trabalho
  commitável — não tem critério de pronto e por construção nunca "termina".
  Decidir se vira convenção de contribuição (`.github/CONTRIBUTING.md`) e sai do
  `/plans`, ou se vira um plano fechado com alvo explícito (ex.: "cobrir
  BrandingTab e GeneralTab avatar").
