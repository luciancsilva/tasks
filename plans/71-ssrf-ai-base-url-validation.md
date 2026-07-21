# Plan 71: Validate and restrict base URL in AI assistant provider configuration

> **Status: EXECUTADO** em 2026-07-20 — validação de `ai_base_url` no save-time
> (`users/service.js`: HTTPS + bloqueio de nomes/IPs privados literais).
> **Endurecido 2026-07-20:** o save-time NÃO resolvia DNS (assimétrico com o
> plano 70), então um host que resolve p/ IP privado (ex.: metadata
> `169.254.169.254`) passava — SSRF autenticado. Agora `getOpenAIClient` valida
> no REQUEST-time via `assertPublicUrl` (reusado de `url/service`, resolve DNS),
> pois a config é consumida pelo cron por dias (anti-rebinding). Teste
> `ai-base-url-ssrf.test.js`. Residual: OpenAI SDK pode seguir redirect
> público→interno (só o host inicial é validado).

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat e6f61485..HEAD -- backend/modules/users/service.js backend/modules/ai-assistant/service.js`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `e6f61485`, 2026-07-20

## Why this matters

Currently, users can set their AI provider's `ai_base_url` to arbitrary internal endpoints (e.g. `http://localhost:22/`), turning the AI feature into an SSRF proxy. Validating that `ai_base_url` is a public `https://` URL secures the backend from unauthorized internal network scanning and exploitation.

## Current state

- The relevant files, each with one line on its role:
  - `backend/modules/ai-assistant/service.js` — configures the OpenAI client.
  - `backend/modules/users/service.js` — updates user configuration.
- Excerpts of the code as it exists today:
  - `backend/modules/ai-assistant/service.js:28-32`
    ```javascript
    if (provider === 'openrouter') {
        config.baseURL = 'https://openrouter.ai/api/v1';
    } else if (provider === 'custom' && user?.ai_base_url) {
        config.baseURL = user.ai_base_url;
    }
    ```

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Install   | `npm install`            | exit 0              |
| Tests     | `npm run backend:test`   | all pass            |
| Lint      | `npm run backend:lint`   | exit 0              |

## Scope

**In scope**:
- `backend/modules/ai-assistant/service.js`
- `backend/modules/users/service.js`

**Out of scope**:
- Changing the OpenAI SDK version or behavior beyond the baseURL config.

## Git workflow

- Branch: `feat/71-ssrf-ai-base-url`
- Commit per step or per logical unit; message style: `fix(ai): validate ai_base_url against SSRF (Plan 71)`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Add validation in user service
In `backend/modules/users/service.js`, reject `ai_base_url` values that don't start with `https://` or contain `localhost` or private IPs.

**Verify**: `npm run backend:test` → all pass

### Step 2: Apply fail-safe in AI service
In `backend/modules/ai-assistant/service.js`, double-check the URL before assigning it to `config.baseURL`. Throw an error if invalid.

**Verify**: `npm run backend:test` → all pass

## Test plan

- Create a test ensuring `updateProfile` rejects `http://localhost:3000` for `ai_base_url`.

## Done criteria

- [ ] `npm run backend:test` exits 0
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

- The code at the locations in "Current state" doesn't match the excerpts.
- A step's verification fails twice after a reasonable fix attempt.
- The fix appears to require touching an out-of-scope file.
