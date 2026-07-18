# 32 — configuração de IA inline (provider/chave/modelo/testar)

> **Status: PROPOSTO** — hoje a IA só funciona com `OPENAI_API_KEY` no servidor e modelo hardcoded. Adicionar UI de configuração por-usuário (provider OpenAI/OpenRouter/custom, chave, modelo, botão testar) expandindo sob o toggle "Assistente de IA".
> **Esforço:** Alto · **Natureza:** julgamento pesado + **segurança** (chave por-usuário, provider, endpoint de teste) · **Modelo:** **forte (opus) — NÃO delegar a modelo fraco**.
> **Branch:** `feat/32-ai-config` (feature — sem merge; o dono valida) · **Depende de:** -

## Decisão de produto

**Expandir inline** sob o toggle "Assistente de IA" em Recursos & complementos —
sem aba nova. Ao ligar o toggle, exibir os campos de configuração logo abaixo.

## Diagnóstico

- Chave só via env: `getOpenAIClient` lê `process.env.OPENAI_API_KEY`
  (`backend/modules/ai-assistant/service.js:19-25`) e lança se ausente.
- Modelo hardcoded `'gpt-4o-mini'` em 3 lugares (`service.js:240,439,567`). Sem
  `baseURL`, sem provider configurável.
- Flags em `User.features` JSON (`backend/models/User.js:128-143`); toggle
  `ai_assistant_enabled` em `frontend/components/Profile/tabs/FeaturesTab.tsx:183-195`
  ("Requer OPENAI_API_KEY configurada no servidor").
- Persistência de profile via `PATCH /api/profile`
  (`ProfileSettings.tsx` handleSubmit ~1032).
- **Resquício útil**: migration `20260420000004-make-password-optional.js`
  referencia colunas mortas `ai_provider/openai_api_key/ollama_base_url/ollama_model`
  (não estão no `User.js` atual) — dá pra revivê-las.
- Funcionalidades habilitadas pela IA (a detalhar na tela): Resumo Diário
  (`generateDailyBrief` 210-286), Insights de tarefa (`generateTaskInsights`
  337-485) e de projeto (`generateProjectInsights` 513-602).

## Implementação Proposta

1. **Model + persistência (backend):** adicionar ao `User.js` `ai_provider`
   (enum `openai|openrouter|custom`), `ai_api_key`, `ai_model`, `ai_base_url`.
   Migration nova com `safeAddColumns` (respeitar ordem de bootstrap — ver
   armadilha em `plans/README.md`). **Segurança:** chave por-usuário no banco —
   **nunca logar**, **nunca retornar em claro** no `GET /api/profile` (mascarar,
   ex. só últimos 4 dígitos). Config por-usuário na UI é aceitável (padrão do
   dono de colar chave e usar), mas o mascaramento na leitura é obrigatório.
2. **AI service (backend):** `getOpenAIClient` passa a ler a config do user
   (provider → baseURL: OpenAI default; OpenRouter `https://openrouter.ai/api/v1`;
   custom = campo `ai_base_url`) e usar `user.ai_model` no lugar do hardcode
   (240/439/567). **Fallback** pro env `OPENAI_API_KEY` quando o user não
   configurou (compat).
3. **Endpoint de teste:** `POST /api/ai-assistant/test` faz chamada mínima (listar
   modelos ou completion curta) e devolve ok/erro amigável **sem vazar a chave**.
4. **Frontend (`FeaturesTab.tsx`):** sob o toggle `ai_assistant_enabled` (quando
   ligado) expandir: select provider (OpenAI/OpenRouter/Custom), input base-url
   (só se custom), input modelo, input chave (type password), botão Testar (chama
   o endpoint, mostra resultado) e um bloco de texto listando as funcionalidades
   habilitadas (Resumo Diário, Insights de tarefa/projeto). Persistir via o
   `PATCH /api/profile` existente estendido com os novos campos.

## Critério de Pronto

- Baseline backend+frontend.
- Testes: backend — `getOpenAIClient` monta baseURL/modelo por provider; endpoint
  de teste retorna erro amigável com chave inválida (mockar OpenAI); `GET
  /api/profile` mascara a chave. Frontend — campos só aparecem com toggle ligado;
  base-url só em custom.
- **Revisão de segurança**: confirmar que a chave nunca aparece em log nem em
  resposta em claro.
- Verificação manual: ligar toggle → configurar OpenRouter + modelo + chave →
  Testar → sucesso → Resumo Diário na Hoje usa o provider configurado.
- Lint dos arquivos tocados.
