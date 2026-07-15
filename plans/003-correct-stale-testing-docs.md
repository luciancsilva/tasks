# Plan 003: Correct stale testing/pre-push documentation

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat a55e4ad..HEAD -- docs/MEMORY.md docs/testing.md README.md .github/CONTRIBUTING.md`
> If any of these changed since this plan was written, compare the "Current
> state" excerpts against the live code before proceeding; on a mismatch, treat
> it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none (but see Maintenance notes re: plan 002)
- **Category**: docs
- **Planned at**: commit `a55e4ad`, 2026-07-11

## Why this matters

Several docs describe a safety net that does not exist, which is worse than
silence: contributors trust it and skip manual verification.

1. There is **no git pre-push hook** installed (no `.husky/`, `core.hooksPath`
   unset, no hook-manager dependency). The `pre-push` npm script is just
   `lint-staged`, which runs `eslint --fix` + `prettier --write` on staged files
   and **runs no tests**. Yet `docs/MEMORY.md`, `README.md`, and
   `.github/CONTRIBUTING.md` state or imply that pushing auto-runs tests.
2. `docs/testing.md` lists E2E and frontend test files that do not exist. The
   real `e2e/tests/` contains `caldav-client.spec.ts`, `inbox.spec.ts`,
   `registration.spec.ts`, `today-view.spec.ts` — none of the four documented
   names. This overstates coverage to any reader.

This plan makes the docs match reality. It is documentation-only — no code, no
scripts, no CI.

## Current state

Verified facts about the actual test/hook setup (do not restate the false
claims — replace them):

- `package.json`: `"pre-push": "lint-staged"`; `lint-staged` config runs only
  `eslint --fix` + `prettier --write` on staged files. No test command anywhere
  in the pre-push path.
- No `.husky/` directory; no hook manager (`husky`/`simple-git-hooks`) in
  dependencies; `.git/hooks/` has only samples. Nothing auto-runs on push.
- Real E2E files (`e2e/tests/`): `caldav-client.spec.ts`, `inbox.spec.ts`,
  `registration.spec.ts`, `today-view.spec.ts`.
- Real frontend test files (only three): `frontend/utils/dateUtils.test.ts`,
  `frontend/components/Shared/__tests__/MarkdownRenderer.checkbox.test.tsx`,
  `frontend/components/Task/TaskDetails/__tests__/TaskContentCard.test.tsx`.

Stale claims to fix:

- `docs/MEMORY.md:49-51`:

```markdown
### Running Tests
- Always run tests before pushing with `npm test`
- Pre-push hooks will automatically run linting, formatting, and tests
```

  `npm test` runs backend tests only (`"test": "npm run backend:test"`), and the
  second bullet is false (no hook; no tests in pre-push).

- `README.md:281`:

```markdown
4. Run linting and tests: `npm run pre-push`
```

  `npm run pre-push` lints/formats staged files only; it runs no tests.

- `.github/CONTRIBUTING.md:286-288`:

```markdown
2. **Run the pre-push checks**
   ```bash
   npm run pre-push
```

  Same misrepresentation — implies tests run.

- `docs/testing.md:44-49` — E2E block lists non-existent files:

```
/e2e/tests/                   # E2E tests (Playwright)
├── login.spec.ts
├── tasks.spec.ts
├── projects.spec.ts
├── subtasks.spec.ts
└── ...
```

  Also note `docs/testing.md` has example snippets referencing
  `e2e/tests/tasks.spec.ts` (around lines 99 and 357) and
  `frontend/components/Task/__tests__/TaskItem.test.tsx` (around line 292) — these
  are illustrative examples of *how to write* a test, not claims that the files
  exist. Leave those illustrative examples alone unless they assert the file
  currently exists; only fix the directory-listing block at lines 44-49 and the
  frontend listing at 51-54.

## Commands you will need

| Purpose                     | Command                                             | Expected                          |
|-----------------------------|-----------------------------------------------------|-----------------------------------|
| Confirm real E2E files      | `ls e2e/tests/`                                      | the four real specs above         |
| Grep for removed false claim| `grep -rn "automatically run linting, formatting, and tests" docs/` | no matches after edit |
| Grep for stale e2e names    | `grep -n "login.spec.ts\|subtasks.spec.ts" docs/testing.md` | no matches after edit     |

(No build/test commands — this is docs-only.)

## Scope

**In scope** (the only files you should modify):
- `docs/MEMORY.md`
- `docs/testing.md`
- `README.md`
- `.github/CONTRIBUTING.md`

**Out of scope** (do NOT touch):
- `package.json` — do NOT add a git hook or change the `pre-push` script here.
  (Installing husky is a separate DX decision; this plan only makes docs
  truthful about the *current* state.)
- Any source or test file.
- The illustrative "how to write a test" code snippets in `docs/testing.md`
  (lines ~99, ~292, ~357) — those teach patterns; don't delete them.

## Git workflow

- Branch: `advisor/003-correct-testing-docs`
- Commit style: Conventional Commits. Suggested:
  `docs: correct stale pre-push and test-file references`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Fix `docs/MEMORY.md` Running Tests section

Rewrite the two bullets at lines 49-51 so they state reality: `npm test` runs
backend tests; frontend tests run via `npm run frontend:test`; there is **no**
automatic pre-push hook — `npm run pre-push` only lints and formats staged
files, so tests must be run manually (or rely on CI). Example replacement:

```markdown
### Running Tests
- Backend tests: `npm run backend:test` (aliased as `npm test`)
- Frontend tests: `npm run frontend:test`
- `npm run pre-push` only lints and formats staged files — it does NOT run
  tests, and there is no automatic git pre-push hook installed. Run tests
  manually before pushing; CI is the authoritative gate.
```

**Verify**: `grep -rn "automatically run linting, formatting, and tests" docs/`
→ no matches.

### Step 2: Fix `README.md:281`

Change the step so it does not claim tests run. Example:

```markdown
4. Lint and format staged files: `npm run pre-push` (does not run tests — run
   `npm run backend:test` and `npm run frontend:test` separately)
```

**Verify**: `grep -n "Run linting and tests: \`npm run pre-push\`" README.md`
→ no matches.

### Step 3: Fix `.github/CONTRIBUTING.md:286-288`

Reword the "Run the pre-push checks" step to clarify it lints/formats staged
files only and that tests are run separately (or via CI). Keep the `npm run
pre-push` command if useful, but remove the implication that it runs tests.

**Verify**: read the section back and confirm it no longer implies tests run on
push.

### Step 4: Fix the E2E and frontend listings in `docs/testing.md`

Replace the E2E directory block (lines ~44-49) so it lists the real files:

```
/e2e/tests/                   # E2E tests (Playwright)
├── caldav-client.spec.ts
├── inbox.spec.ts
├── registration.spec.ts
└── today-view.spec.ts
```

Update the frontend block (lines ~51-54) to reflect that only a few component
tests currently exist, rather than implying broad component coverage. A short,
honest note is enough (e.g. "Frontend test coverage is currently limited — see
the three existing tests under `frontend/`").

**Verify**: `grep -n "login.spec.ts\|tasks.spec.ts\|projects.spec.ts\|subtasks.spec.ts" docs/testing.md`
→ no matches in the directory-listing block. (`tasks.spec.ts` may still legitimately
appear in the illustrative "how to write a test" example blocks around lines 99/357 —
that is fine; only the directory listing at 44-49 must be corrected.)

## Test plan

None — documentation-only. Verification is the grep checks above plus a
read-through confirming no remaining claim that pushing runs tests.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `grep -rn "automatically run linting, formatting, and tests" docs/` → no matches
- [ ] `docs/testing.md` E2E listing names exactly `caldav-client.spec.ts`,
      `inbox.spec.ts`, `registration.spec.ts`, `today-view.spec.ts`
- [ ] Neither `README.md:~281` nor `.github/CONTRIBUTING.md` claims `npm run
      pre-push` runs tests
- [ ] `git status` shows only `docs/MEMORY.md`, `docs/testing.md`, `README.md`,
      `.github/CONTRIBUTING.md` modified
- [ ] `plans/README.md` status row for 003 updated

## STOP conditions

Stop and report back (do not improvise) if:

- Any of the four files' content does not match the "Current state" excerpts
  (drift since this plan was written), especially if a git pre-push hook now
  exists (`ls .husky/ 2>/dev/null`) — in that case the docs may be *correct* and
  this plan is moot; report it.
- The line numbers are off by more than a few lines and you cannot confidently
  locate the stale claims.

## Maintenance notes

- If plan 002 (CI runs frontend tests + typecheck + audit) lands, consider
  pointing these docs at CI as the authoritative gate — this plan already frames
  it that way, so no rework needed.
- Alternative direction (not taken here): install a real husky pre-push hook so
  the docs become true instead of trimming them. That is a DX plan of its own;
  this plan chose the low-risk "make docs match reality" path.
- Reviewer should confirm no illustrative code examples in `docs/testing.md`
  were deleted — only the inaccurate directory listing and pre-push claims.
