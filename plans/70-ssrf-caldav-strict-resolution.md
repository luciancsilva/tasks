# Plan 70: Use strict resolution to prevent SSRF bypasses in CalDAV connectivity

> **Status: EXECUTADO** em 2026-07-20 — `validateCalDAVUrl` faz protocol check +
> `isPrivateOrLocalhost` + `resolveAndValidateHostname` (DNS lookup, rejeita se
> qualquer IP resolvido é privado; anti-rebinding), redirects desabilitados no
> fetch. Revisado nesta rodada: `isPrivateIP` cobre 127/10/172.16/192.168/
> 169.254/0/100.64/198.18/broadcast + IPv6 ::1/fc/fd/fe80. Gap residual de baixa
> severidade: IPv4-mapped IPv6 (`::ffff:x.x.x.x`) tratado como público.

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat e6f61485..HEAD -- backend/modules/caldav/api/remote-calendar-controller.js`
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

The `isPrivateOrLocalhost` function in the CalDAV controller currently evaluates safety strictly by checking string prefixes (e.g., `localhost`, `127.0.0.1`). This is vulnerable to DNS rebinding or obfuscated loopback formats like `127.1`. An attacker can bypass this check and exploit the backend to dispatch requests to internal services (SSRF). Implementing strict resolution and IP blocking neutralizes this critical risk without affecting legitimate external CalDAV usage.

## Current state

- The relevant files, each with one line on its role:
  - `backend/modules/caldav/api/remote-calendar-controller.js` — handles CalDAV URL connection testing.
- Excerpts of the code as it exists today:
  - `backend/modules/caldav/api/remote-calendar-controller.js:8-20`
    ```javascript
    function isPrivateOrLocalhost(hostname) {
        if (!hostname) return true;
        const lower = hostname.toLowerCase();
        if (lower === 'localhost' || lower === '127.0.0.1' || lower === '::1') {
            return true;
        }
        if (lower.startsWith('192.168.') || lower.startsWith('10.')) {
            return true;
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
- `backend/modules/caldav/api/remote-calendar-controller.js`

**Out of scope**:
- Any modifications to the CalDAV synchronization logic itself.

## Git workflow

- Branch: `feat/70-ssrf-caldav`
- Commit per step or per logical unit; message style: `fix(caldav): strict SSRF resolution mitigation (Plan 70)`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Implement robust DNS and IP validation
Import `dns` and use `ipaddr.js` (or a robust regex if avoiding deps) to resolve the hostname and check against private/loopback IP ranges.

**Verify**: `npm run backend:test` → all pass

### Step 2: Use custom http/https Agent in Axios
Update the Axios call in `testConnection` to use a custom Agent that binds to the resolved and verified IP to prevent DNS rebinding between check and fetch.

**Verify**: `npm run backend:test` → all pass

## Test plan

- Ensure existing CalDAV integration tests continue to pass.
- Write a unit test verifying `127.1` and `169.254.169.254` are blocked.

## Done criteria

- [ ] `npm run backend:test` exits 0
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

- The code at the locations in "Current state" doesn't match the excerpts.
- A step's verification fails twice after a reasonable fix attempt.
- The fix appears to require touching an out-of-scope file.
