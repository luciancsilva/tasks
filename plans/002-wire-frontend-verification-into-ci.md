# Plan 002: Frontend tests, a typecheck script, and a dependency audit run in CI

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat a55e4ad..HEAD -- .github/workflows/ci.yml package.json`
> If either file changed since this plan was written, compare the "Current
> state" excerpts against the live code before proceeding; on a mismatch, treat
> it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: dx
- **Planned at**: commit `a55e4ad`, 2026-07-11

## Why this matters

Three cheap, high-leverage gaps in the verification pipeline:

1. **Frontend Jest tests never run in CI.** `package.json` defines
   `frontend:test` and a fully configured `jest.config.js`, and tests exist,
   but CI runs only backend tests + lint + build. Any frontend regression —
   including breakage of the existing tests — reaches `main` undetected, and any
   new frontend test a contributor writes provides zero gate value. (This is a
   prerequisite for plan 004, which adds frontend tests.)
2. **No standalone typecheck.** `tsc --noEmit` runs only bundled inside the slow
   `frontend:build` (webpack). There is no fast, isolated type feedback loop and
   CI cannot fail fast on a type error separately from bundling.
3. **No dependency audit.** CI never runs `npm audit`, yet `package.json`
   carries a large hand-maintained `overrides` block patching transitive
   advisories — exactly the maintenance an automated audit would surface earlier.

All three are additive CI/script changes with no product risk.

## Current state

- `.github/workflows/ci.yml` — the only workflow. Runs lint, backend tests, and
  build; no frontend test / typecheck / audit step:

```yaml
# .github/workflows/ci.yml
name: CI

on:
  pull_request:
    branches: [ main ]
  push:
    branches: [ main ]

permissions:
  contents: read

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
    - name: Checkout code
      uses: actions/checkout@v4

    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '22'
        cache: 'npm'

    - name: Install dependencies
      run: npm install

    - name: Run linting
      run: npm run lint

    - name: Run backend tests
      run: npm run backend:test
      env:
        FF_ENABLE_BACKUPS: 'true'
        FF_ENABLE_CALDAV: 'true'
        FF_ENABLE_CALENDAR: 'true'

    - name: Build frontend
      run: npm run build
```

- `package.json` scripts (relevant excerpt) — no `typecheck` script exists;
  `frontend:test` and `frontend:build` do:

```json
"build": "npm run frontend:build",
"frontend:build": "npm run clean && tsc --noEmit && webpack --config webpack.config.js",
"frontend:test": "jest",
"lint": "npm run frontend:lint && npm run backend:lint",
```

- `jest.config.js` is already configured for the frontend (jsdom, ts-jest,
  `roots: ['<rootDir>/frontend']`, setup at `frontend/__tests__/setup.ts`). The
  three existing frontend tests are:
  - `frontend/utils/dateUtils.test.ts`
  - `frontend/components/Shared/__tests__/MarkdownRenderer.checkbox.test.tsx`
  - `frontend/components/Task/TaskDetails/__tests__/TaskContentCard.test.tsx`
- `tsconfig.json` `include: ["frontend/**/*"]`, `strict: false`. So
  `tsc --noEmit` type-checks the frontend only. (This plan does NOT change
  `strict` — that is a separate, larger effort.)

## Commands you will need

| Purpose          | Command                          | Expected on success              |
|------------------|----------------------------------|----------------------------------|
| Frontend tests   | `npm run frontend:test`          | all pass, exit 0                 |
| Typecheck (new)  | `npm run typecheck`              | exit 0, no type errors           |
| Dependency audit | `npm audit --audit-level=high`   | exit 0 **or** lists high/crit    |
| Lint             | `npm run lint`                   | exit 0                           |

## Scope

**In scope** (the only files you should modify):
- `package.json` (add a `typecheck` script only)
- `.github/workflows/ci.yml` (add steps)

**Out of scope** (do NOT touch):
- `tsconfig.json` — do NOT change `strict` or any compiler option here.
- Any test file, any source file. If `npm run frontend:test` or
  `npm run typecheck` fails on **existing** code, that is a STOP condition (see
  below) — do not fix product/test code in this plan.
- Playwright / `test:ui` — wiring E2E into CI is explicitly out of scope (it
  needs browser install and sharding; separate plan).

## Git workflow

- Branch: `advisor/002-ci-frontend-verification`
- Commit style: Conventional Commits. Suggested:
  `ci: run frontend tests, typecheck, and npm audit`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Add a `typecheck` script

In `package.json` `scripts`, add a `typecheck` entry that runs the compiler in
no-emit mode (same invocation `frontend:build` already uses, just standalone):

```json
"typecheck": "tsc --noEmit",
```

Place it near the other top-level scripts (e.g. after `"build"`). Do not remove
or reorder existing scripts.

**Verify**: `npm run typecheck` → exit 0, no type errors. (If it reports
pre-existing type errors, STOP — see STOP conditions.)

### Step 2: Confirm the frontend test suite passes locally

Before wiring it into CI, confirm it is green as-is.

**Verify**: `npm run frontend:test` → all existing frontend tests pass, exit 0.
(If any fail on current `main`, STOP and report — do not modify tests here.)

### Step 3: Add CI steps for typecheck, frontend tests, and audit

Edit `.github/workflows/ci.yml`. Add three steps inside the existing `test`
job's `steps` list. Order them so fast checks fail first: put **Typecheck**
right after "Run linting", **Run frontend tests** after "Run backend tests", and
**Dependency audit** last (non-blocking). Add exactly:

```yaml
    - name: Typecheck
      run: npm run typecheck

    - name: Run frontend tests
      run: npm run frontend:test

    - name: Dependency audit (informational)
      run: npm audit --audit-level=high || true
```

Notes:
- The `|| true` on the audit step makes it **non-blocking** (informational
  only) to avoid failing CI on newly disclosed advisories that the team triages
  via the `overrides` block. Do not make it blocking in this plan.
- Do not remove or reorder the existing steps; only insert these three.

**Verify**: The file is valid YAML — run
`node -e "require('js-yaml').load(require('fs').readFileSync('.github/workflows/ci.yml','utf8')); console.log('yaml ok')"`
→ prints `yaml ok`. (`js-yaml` is already a dependency.)

### Step 4: Local dry-run of the full gate

Confirm each new CI command runs locally without mutating the tree:

**Verify**:
- `npm run typecheck` → exit 0
- `npm run frontend:test` → all pass
- `npm run lint` → exit 0
- `git status` → only `package.json` and `.github/workflows/ci.yml` modified

## Test plan

No new automated tests. This plan changes CI wiring and one script. Verification
is that each new command succeeds locally (Step 4) and the YAML parses (Step 3).

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `package.json` contains a `"typecheck": "tsc --noEmit"` script
- [ ] `npm run typecheck` exits 0
- [ ] `npm run frontend:test` exits 0
- [ ] `.github/workflows/ci.yml` contains steps named `Typecheck`,
      `Run frontend tests`, and `Dependency audit (informational)`
- [ ] `ci.yml` parses as valid YAML (Step 3 verify prints `yaml ok`)
- [ ] `git status` shows only `package.json` and `.github/workflows/ci.yml`
      modified
- [ ] `plans/README.md` status row for 002 updated

## STOP conditions

Stop and report back (do not improvise) if:

- `npm run typecheck` reports type errors on the existing codebase. Report the
  count and first few errors — fixing them is out of scope (they predate this
  plan) and would need its own effort.
- `npm run frontend:test` has any failing test on current `main`. Report which —
  do not edit tests or source to make it pass.
- The `ci.yml` or `package.json` content does not match the "Current state"
  excerpts (drift since this plan was written).

## Maintenance notes

- Once plan 004 adds meaningful frontend tests, the "Run frontend tests" step
  becomes a real regression gate for the Kanban/recurrence UI.
- Follow-ups deliberately deferred: (a) making the audit step blocking after the
  dependency tree is clean; (b) wiring Playwright `test:ui` into a dedicated CI
  job; (c) turning on `tsconfig` `strict` incrementally. Each is its own plan.
- Reviewer should confirm the audit step keeps `|| true` (non-blocking) and that
  no existing CI step was reordered or dropped.
