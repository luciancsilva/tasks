# Plan 010: Enforce ownership validation on MCP create_task project_id, MCP project area_id, and goals area_id

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat f071873..HEAD -- backend/modules/mcp/tools/taskTools.js backend/modules/mcp/tools/projectTools.js backend/modules/goals/service.js backend/tests/integration/mcp/mcp-tools.test.js backend/tests/unit/services/goals*.test.js`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `f071873`, 2026-07-12

## Why this matters

Three write paths accept foreign-key ids from the client without checking the
referenced resource belongs to the requesting user (IDOR / cross-tenant
reference):

1. MCP `create_task` stores any `project_id` raw — a task can be planted
   inside **another user's project**, surfacing in their project views and
   per-project CalDAV calendars. The sibling `update_task` handler already
   validates; create just forgot.
2. MCP `create_project` / `update_project` store any `area_id` raw.
3. The goals module (REST) stores any `area_id` on create/update, and its
   list path resolves an `area_uid` without user scoping.

All fixes reuse validators that already exist in
`backend/modules/tasks/utils/validation.js`. MCP tools are reachable over
HTTP by any API-token holder (see `backend/modules/mcp/httpTransport.js`),
so this is a real multi-user boundary, not just a local stdio concern.

## Current state

- `backend/modules/mcp/tools/taskTools.js` — MCP task tools.
  - `validateProjectAccess` is already imported at line 11:
    ```js
    const { validateProjectAccess } = require('../../tasks/utils/validation');
    ```
  - **The bug** — `create_task` handler (lines 222-235) writes raw:
    ```js
    // taskTools.js:225-233
    const taskData = {
        user_id: context.userId,
        name: params.name,
        note: params.description || '',
        priority: params.priority ? priorityMap[params.priority] : 1,
        status: 0, // pending
        due_date: params.due_date || null,
        project_id: params.project_id || null,   // ← unvalidated
    };
    ```
  - **The pattern to copy** — `update_task` handler (lines 349-355):
    ```js
    if (params.project_id !== undefined) {
        const validProjectId = await validateProjectAccess(
            params.project_id,
            context.userId
        );
        updates.project_id = validProjectId;
    }
    ```

- `backend/modules/mcp/tools/projectTools.js` — MCP project tools. Does NOT
  import any validator.
  - `create_project` handler (lines 207-219): `area_id: params.area_id || null`
    (line 214) — unvalidated.
  - `update_project` handler (line 338):
    `if (params.area_id !== undefined) updates.area_id = params.area_id;` —
    unvalidated.

- `backend/modules/tasks/utils/validation.js` — the validators.
  - `validateProjectAccess(projectIdOrUid, userId)` (lines 9-35): accepts id
    or uid, returns the resolved numeric `project.id`, returns `null` for
    empty input, throws `Error('Invalid project.')` / `Error('Forbidden')`.
    Ownership OR shared rw/admin access counts as valid.
  - `validateAreaAccess(areaIdOrUid, userId)` (lines 145-160): accepts id or
    uid, scopes the lookup by `user_id`, returns resolved numeric `area.id`,
    returns `null` for empty input, throws `Error('Invalid area.')`.

- `backend/modules/goals/service.js` — goals business logic (REST module).
  - `getAll` (lines 8-20): `Area.findOne({ where: { uid: areaUid } })` at
    line 10 has **no `user_id` filter** (low impact — the follow-up
    `findAllByArea(userId, area.id)` re-scopes — but same missing-ownership
    pattern).
  - `create` (lines 28-45): requires `area_id` truthy, then stores it raw
    (line 38).
  - `update` (lines 47-62): `if (area_id !== undefined) updates.area_id = area_id;`
    (line 54) — raw.
  - Error conventions in this module: `ValidationError` / `NotFoundError`
    from `backend/shared/errors` (see lines 5, 24, 31, 34). For a
    cross-tenant or nonexistent area, throw
    `new ValidationError('Invalid area.')` — do NOT leak whether the area
    exists for another user.

- MCP context shape: `context.userId` is the numeric user id — set in both
  transports (`backend/modules/mcp/server.js:45-49` and
  `backend/modules/mcp/httpTransport.js:20-23`).

- Test harness for MCP: `backend/tests/integration/mcp/mcp-tools.test.js` —
  drives tools over the StreamableHTTP endpoint with a `tt_` API token;
  helpers `parseSseResponse`/`getToolContent` at the top of the file;
  `describe('create_task')` starts at line 184.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Backend tests (all) | `npm run backend:test` | exit 0 |
| MCP integration tests | `cd backend && npx cross-env NODE_ENV=test npx jest tests/integration/mcp/mcp-tools.test.js` | all pass |
| Goals tests | `cd backend && npx cross-env NODE_ENV=test npx jest goals` | all pass |
| Lint | `npm run backend:lint` | exit 0 |

## Scope

**In scope** (the only files you should modify):
- `backend/modules/mcp/tools/taskTools.js` (create_task handler only)
- `backend/modules/mcp/tools/projectTools.js` (create_project + update_project handlers)
- `backend/modules/goals/service.js` (getAll area lookup, create, update)
- `backend/tests/integration/mcp/mcp-tools.test.js` (add cases)
- Goals tests: extend the existing goals test file if one exists (check
  `backend/tests/` for `goal`), otherwise create
  `backend/tests/unit/modules/goals.test.js` following the closest existing
  unit-test pattern.

**Out of scope** (do NOT touch, even though they look related):
- `backend/modules/tasks/utils/validation.js` — the validators are correct;
  reuse, don't modify.
- Tasks REST routes (`modules/tasks/routes.js`) — they already validate via
  `buildTaskAttributes`/validators.
- `assigned_to`/`involves` person-reference validation in
  `modules/tasks/core/builders.js` — separate audited finding, separate plan.
- MCP `list_tasks` date semantics — plan 012 covers it.

## Git workflow

- Branch: `advisor/010-mcp-goals-ownership-validation`
- Commit style: conventional commits, e.g.
  `fix(security): validate ownership of project/area ids in MCP tools and goals`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Fix MCP `create_task`

In `backend/modules/mcp/tools/taskTools.js`, inside the `create_task` handler
(before building `taskData` at line ~225), resolve the project id exactly like
`update_task` does:

```js
const validProjectId = await validateProjectAccess(
    params.project_id,
    context.userId
);
```

and use `project_id: validProjectId` in `taskData` (note:
`validateProjectAccess` returns `null` when `params.project_id` is
empty/undefined, so the `|| null` fallback becomes unnecessary).

**Verify**: `cd backend && npx cross-env NODE_ENV=test npx jest tests/integration/mcp/mcp-tools.test.js` → existing tests still pass.

### Step 2: Fix MCP `create_project` and `update_project`

In `backend/modules/mcp/tools/projectTools.js`:

1. Add the import at the top, next to the existing requires:
   ```js
   const { validateAreaAccess } = require('../../tasks/utils/validation');
   ```
2. `create_project` handler: replace `area_id: params.area_id || null`
   (line ~214) with a pre-resolved value:
   ```js
   const validAreaId = await validateAreaAccess(params.area_id, context.userId);
   ```
   then `area_id: validAreaId`.
3. `update_project` handler: replace the raw assignment (line ~338) with:
   ```js
   if (params.area_id !== undefined) {
       updates.area_id = await validateAreaAccess(params.area_id, context.userId);
   }
   ```

The MCP tool dispatcher already converts thrown errors into MCP error results
(see how `update_task`'s `validateProjectAccess` errors surface — same
mechanism), so no extra error handling is needed.

**Verify**: `cd backend && npx cross-env NODE_ENV=test npx jest tests/integration/mcp/mcp-tools.test.js` → pass.

### Step 3: Fix goals service

In `backend/modules/goals/service.js`:

1. Line 10 — scope the area lookup:
   ```js
   const area = await Area.findOne({ where: { uid: areaUid, user_id: userId } });
   ```
2. `create` (after the `!area_id` check at lines 33-35) — verify ownership:
   ```js
   const area = await Area.findOne({ where: { id: area_id, user_id: userId } });
   if (!area) {
       throw new ValidationError('Invalid area.');
   }
   ```
   (`Area` is already imported at line 4; `ValidationError` at line 5.)
3. `update` — when `area_id !== undefined` and not null, run the same check
   before assigning `updates.area_id`.

**Verify**: `cd backend && npx cross-env NODE_ENV=test npx jest goals` → pass
(if no goals test file exists yet, this returns "no tests found" — that's
expected until Step 4).

### Step 4: Tests

**MCP** — extend `backend/tests/integration/mcp/mcp-tools.test.js`. The file
already creates a primary user + token; add a second user via
`createTestUser` with a project and an area. Cases:

1. `create_task` with `project_id` of the *other* user's project → tool
   returns an error result (`isError` true / error content), and no task row
   is created under that project.
2. `create_task` with own project id → succeeds, task has that `project_id`.
3. `create_project` with other user's `area_id` → error result, no project
   created with that `area_id`.
4. `update_project` moving own project to other user's `area_id` → error
   result, project's `area_id` unchanged.

**Goals** — in the goals test file (existing or new): create goal with
another user's `area_id` → rejects with validation error; update likewise;
`getAll` with another user's `areaUid` → returns `[]` (already true, now for
the right reason).

**Verify**: `npm run backend:test` → exit 0, all new tests pass.

## Test plan

As Step 4. Patterns: `backend/tests/integration/mcp/mcp-tools.test.js` for
MCP (SSE parsing helpers at the top of that file);
`backend/tests/unit/services/rolesService.test.js` for unit-test structure if
a new goals test file is needed. 6+ new cases total.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `npm run backend:test` exits 0; new cross-tenant tests exist and pass
- [ ] `grep -n "project_id: params.project_id" backend/modules/mcp/tools/taskTools.js` → no matches
- [ ] `grep -n "area_id: params.area_id" backend/modules/mcp/tools/projectTools.js` → no matches
- [ ] `grep -n "uid: areaUid }" backend/modules/goals/service.js` → no matches
      (lookup now includes `user_id`)
- [ ] `npm run backend:lint` exits 0
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- Any excerpt in "Current state" doesn't match the live code (drift).
- `validateProjectAccess` or `validateAreaAccess` behave differently than
  described (e.g. don't accept numeric ids) when you exercise them — check
  their unit expectations in `backend/tests/` first, then report.
- Existing MCP tests fail after Step 1 because they legitimately created
  tasks in projects belonging to a *different* test user — that would mean
  a fixture depends on the bug; report which test.
- The goals module turns out to accept `area_id` as a uid string from the
  frontend (check `frontend/utils/goalsService.ts` or equivalent if unsure) —
  if so the ownership check must use the id-or-uid pattern of
  `validateAreaAccess` instead of `{ id: area_id }`; report before deviating.

## Maintenance notes

- Any new MCP tool that writes a foreign key (`project_id`, `area_id`,
  `parent_task_id`, `assigned_to`) must route it through the validators in
  `modules/tasks/utils/validation.js`. Reviewers should reject raw
  `params.*_id` assignments in `backend/modules/mcp/tools/`.
- Related deferred finding: `assigned_to`/`involves` person uids on tasks are
  stored unvalidated (`modules/tasks/core/builders.js:173-179, 267-272`) and
  the people delete-guard ignores `involves`. Future plan.
- The goals REST routes pass numeric `area_id` today; if the frontend
  migrates to uid-based payloads (the repo direction per commit b294553),
  swap the check to `validateAreaAccess`.
