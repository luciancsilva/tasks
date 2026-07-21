# Plan 74: Fix backend test coverage configuration

> **Status: EXECUTADO** em 2026-07-20 — config de cobertura do Jest passou a
> incluir `modules/` e removeu `routes/` obsoleto (commit `8e0f5e05`).

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat e6f61485..HEAD -- backend/jest.config.js`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: tests
- **Planned at**: commit `e6f61485`, 2026-07-20

## Why this matters

The backend Jest configuration misses the `modules/**/*.js` path and includes a non-existent `routes/**/*.js` path. Because most controllers, services, and core logic live under `modules/`, the reported test coverage is highly inflated, masking untested critical paths. Correcting this provides accurate insights into technical debt and regression risks.

## Current state

- The relevant files, each with one line on its role:
  - `backend/jest.config.js` — configures the test runner and coverage collection.
- Excerpts of the code as it exists today:
  - `backend/jest.config.js:5-9`
    ```javascript
    collectCoverageFrom: [
        'routes/**/*.js',
        'models/**/*.js',
        'services/**/*.js',
        'utils/**/*.js',
    ],
    ```

## Commands you will need

| Purpose   | Command                            | Expected on success |
|-----------|------------------------------------|---------------------|
| Install   | `npm install`                      | exit 0              |
| Coverage  | `npm run backend:test:coverage`    | runs, outputs valid coverage report |

## Scope

**In scope**:
- `backend/jest.config.js`

**Out of scope**:
- Adding new tests to improve coverage.

## Git workflow

- Branch: `feat/74-test-backend-coverage-config`
- Commit per step or per logical unit; message style: `fix(tests): include modules directory in backend coverage (Plan 74)`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Update jest.config.js
Edit `backend/jest.config.js`. Remove `routes/**/*.js` from `collectCoverageFrom` and add `modules/**/*.js`.

**Verify**: `npm run backend:test:coverage` → generates report successfully, incorporating modules correctly.

## Test plan

- Run `npm run backend:test:coverage` to verify standard operation. No code logic is modified.

## Done criteria

- [ ] `npm run backend:test:coverage` exits 0 and logs coverage data.
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

- The code at the locations in "Current state" doesn't match the excerpts.
- A step's verification fails twice after a reasonable fix attempt.
- The fix appears to require touching an out-of-scope file.
