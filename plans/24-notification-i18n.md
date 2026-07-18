# 24 — i18n de notificações (pt/en)

> **Status: PROPOSTO** — notificações agendadas saem sempre em inglês, ignorando `User.language`; traduzir via dicionário leve no backend e corrigir o plural ("1 hours").
> **Esforço:** Médio · **Natureza:** meio-termo (montar dicionário + threading do idioma) · **Modelo:** médio (sonnet).
> **Branch:** `main` · **Depende de:** -

## Diagnóstico

Notificações agendadas usam strings em inglês hardcoded e não consultam
`User.language` (`backend/models/User.js:59`). O usuário reportou "Task due soon"
/ "Your task \"X\" is due in 1 hours" com idioma PT — note o bug de plural.

Não existe mecanismo de i18n no backend (só o frontend tem `public/locales/**`).
Strings hardcoded em:

1. `backend/modules/tasks/dueTaskService.js:167-197` — `generateNotificationContent`
   (não recebe user/idioma). Título "Task due soon"/"Task is overdue"; mensagens
   com plural cru `is due in ${hoursUntilDue} hours` (190), overdue 0/1/N dias
   (174/176/178).
2. `backend/modules/projects/dueProjectService.js:175-197` — idêntico p/ projeto.
3. `backend/modules/tasks/deferredTaskService.js:100-101` — "Task is now active" /
   `Your task "X" is now available to work on`.

Notificação criada via `Notification.createNotification({title, message, ...})`
(`dueTaskService.js:127-142`). O serviço já carrega `task.User`
(`dueTaskService.js:122`), então o idioma está acessível.

## Implementação Proposta

1. Criar `backend/modules/notifications/i18n.js`: um dicionário por chave lógica ×
   idioma, com interpolação e plural correto. Ex.:
   ```js
   // messages[type][lang] => função(params) => string
   // fallback: lang ausente => 'en'
   const t = (key, lang, params) => (dict[key][lang] || dict[key].en)(params);
   ```
   Cobrir as chaves: `task_due_soon` (title+body <1h / Nh / amanhã),
   `task_overdue` (title+body hoje/ontem/N dias), `project_due_soon`,
   `project_overdue`, `task_now_active`. Idiomas mínimos: **pt** e **en**
   (demais caem no fallback en). Plural resolvido por lógica interna (1 → "hora",
   N → "horas"; "1 dia" vs "N dias").
2. `generateNotificationContent` (e equivalentes nos 3 services) passam a receber
   `lang` (de `task.User.language` / `project.User.language`, default `'en'`) e
   retornam `{title, message}` já traduzidos, delegando ao dicionário.
3. Validar que `task.User`/`project.User` estão no include das queries desses
   services (o de task já está; conferir project e deferred).

## Critério de Pronto

- `npm run backend:test` limpo (baseline antes).
- Testes: unit do dicionário (pt/en; plural 1 vs N; overdue 0/1/N dias) e
  integração de `checkDueTasks` com user `language='pt'` gerando título/mensagem
  PT sem "1 hours". Seguir padrão `backend/tests/`.
- Lint dos arquivos tocados (`npx eslint`).
