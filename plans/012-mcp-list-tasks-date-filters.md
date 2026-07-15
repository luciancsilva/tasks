# Plan 012: Make MCP list_tasks `today` and `upcoming` actually filter by date

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat f071873..HEAD -- backend/modules/mcp/tools/taskTools.js backend/tests/integration/mcp/mcp-tools.test.js`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none (independent of plan 010, though both touch
  `taskTools.js` — if executing both, land 010 first and rebase)
- **Category**: bug
- **Planned at**: commit `f071873`, 2026-07-12

## Why this matters

The MCP `list_tasks` tool advertises `type: 'today' | 'upcoming' | ...` but
implements both as "everything not archived" — no date predicate at all. An
AI assistant asking tududi "what's due today?" receives the user's entire
backlog (capped at `limit`, default 50, ordered by `created_at DESC`, so not
even the most relevant 50). This silently poisons every downstream answer an
MCP client gives about the user's day. The fix is small: apply the same
timezone-aware day-bounds helpers the REST API uses.

## Current state

- `backend/modules/mcp/tools/taskTools.js` — MCP task tools.
  - Tool schema (lines 65-69) promises the semantics:
    ```js
    type: {
        type: 'string',
        enum: ['today', 'upcoming', 'completed', 'archived', 'all'],
        description: 'Filter tasks by type',
    },
    ```
  - **The bug** (lines 106-113): `today` and `upcoming` collapse to the same
    non-filter:
    ```js
    // Apply type filter
    if (params.type === 'completed') {
        where.status = 2;
    } else if (params.type === 'archived') {
        where.status = 6;
    } else if (params.type === 'today' || params.type === 'upcoming') {
        where.status = { [Op.ne]: 6 }; // Not archived
    }
    ```
  - The handler builds `where = { user_id: context.userId }` (line 87) and
    queries via `taskRepository.findAll(where, { include: [...], limit,
    order: [['created_at', 'DESC']] })` (lines 115-122). `Op` is already
    imported (line 9).
  - `context.user` is the full Sequelize user instance in both transports
    (`backend/modules/mcp/server.js:45-49`,
    `backend/modules/mcp/httpTransport.js:20-23`), and the file already uses
    `context.user.timezone` (line ~373), so the timezone is available.

- `backend/utils/timezone-utils.js` — the canonical date helpers the REST
  path uses (imported in `backend/modules/tasks/queries/query-builders.js:4-8`):
  ```js
  // timezone-utils.js:67-70
  function getTodayBoundsInUTC(userTimezone) { ... }   // → { start: Date, end: Date }
  // timezone-utils.js:79-87
  function getUpcomingRangeInUTC(userTimezone, days = 7) { ... } // → { start, end }
  ```
  Plus `getSafeTimezone(userTimezone)` (also exported) which falls back to
  UTC for null/invalid values — the REST code always wraps the raw user
  timezone with it (`query-builders.js:118`). Match that.

- Semantics to implement (keep them simple — MCP does not do the REST
  Today view's status/plan logic or virtual recurring expansion):
  - `today`: tasks that are not completed/archived and due **today or
    earlier** (overdue included — an assistant asked "what's due today"
    must see overdue items): `status NOT IN (2, 6)` and
    `due_date <= todayBounds.end` and `due_date != null`.
  - `upcoming`: not completed/archived, `due_date` within
    `getUpcomingRangeInUTC(tz, 7)` bounds (start ≤ due_date ≤ end).
  - Note in the tool's `description` fields that recurring virtual
    occurrences are not expanded (parity with current behavior).

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Backend tests (all) | `npm run backend:test` | exit 0 |
| MCP tests | `cd backend && npx cross-env NODE_ENV=test npx jest tests/integration/mcp/mcp-tools.test.js` | all pass |
| Lint | `npm run backend:lint` | exit 0 |

## Scope

**In scope** (the only files you should modify):
- `backend/modules/mcp/tools/taskTools.js` (list_tasks handler + type/enum
  descriptions only)
- `backend/tests/integration/mcp/mcp-tools.test.js` (add cases in the
  existing `describe('list_tasks')` block, line 110)

**Out of scope** (do NOT touch, even though they look related):
- REST `/tasks` route or `queries/query-builders.js` — reference only.
- `backend/utils/timezone-utils.js` — reuse, don't modify.
- Virtual recurring-occurrence expansion for MCP — bigger feature, not this
  plan.
- Other MCP tools.

## Git workflow

- Branch: `advisor/012-mcp-list-tasks-date-filters`
- Commit style: conventional commits, e.g.
  `fix(mcp): apply date filters to list_tasks today/upcoming types`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Implement the date predicates

In `backend/modules/mcp/tools/taskTools.js`:

1. Import the helpers at the top:
   ```js
   const {
       getSafeTimezone,
       getTodayBoundsInUTC,
       getUpcomingRangeInUTC,
   } = require('../../../utils/timezone-utils');
   ```
2. Replace the type-filter block (lines 106-113) with:
   ```js
   if (params.type === 'completed') {
       where.status = 2;
   } else if (params.type === 'archived') {
       where.status = 6;
   } else if (params.type === 'today') {
       const tz = getSafeTimezone(context.user.timezone);
       const todayBounds = getTodayBoundsInUTC(tz);
       where.status = { [Op.notIn]: [2, 6] };
       where.due_date = { [Op.lte]: todayBounds.end, [Op.ne]: null };
   } else if (params.type === 'upcoming') {
       const tz = getSafeTimezone(context.user.timezone);
       const range = getUpcomingRangeInUTC(tz, 7);
       where.status = { [Op.notIn]: [2, 6] };
       where.due_date = { [Op.between]: [range.start, range.end] };
   }
   ```
   Note: an explicit `params.status` (applied earlier, lines 91-99) would be
   overwritten by these `where.status` assignments — preserve the existing
   precedence by only setting `where.status` in the type branch when
   `params.status` was not provided (`if (!params.status) where.status = ...`).
3. Update the `type` property description in the tool schema to state the
   semantics, e.g.:
   `'today' = due today or overdue (open tasks); 'upcoming' = due in the next 7 days (open tasks); recurring virtual occurrences are not expanded`.

**Verify**: `cd backend && npx cross-env NODE_ENV=test npx jest tests/integration/mcp/mcp-tools.test.js` → existing list_tasks tests pass (they use no `type` or non-date types — confirm; if one asserts today/upcoming returns undated tasks, that test embodied the bug: STOP and report).

### Step 2: Add tests

In the `describe('list_tasks')` block of
`backend/tests/integration/mcp/mcp-tools.test.js` (starts line 110), using
the file's existing `callTool`/`getToolContent` helpers, seed tasks with:
overdue due_date (yesterday), due today, due in 3 days, due in 30 days, no
due_date, and one completed today. Assert:

1. `type: 'today'` returns overdue + due-today only (not the 3-day, 30-day,
   undated, or completed ones).
2. `type: 'upcoming'` returns due-today + 3-day tasks only.
3. `type: 'all'` (or omitted) unchanged: returns everything non-filtered.
4. `type: 'today'` combined with `status: 'in_progress'` respects the
   explicit status (precedence rule from Step 1).

Use UTC for the test user's timezone (default) so bounds are deterministic;
construct dates relative to `new Date()` — never hardcode.

**Verify**: `cd backend && npx cross-env NODE_ENV=test npx jest tests/integration/mcp/mcp-tools.test.js` → all pass including 4 new.

### Step 3: Full suite

**Verify**: `npm run backend:test` → exit 0.

## Test plan

Covered in Step 2 — 4 new integration cases in the existing MCP test file,
following its SSE-parsing helpers (`parseSseResponse`, `getToolContent`,
lines 23-57). Timezone edge cases (non-UTC user) are deliberately covered by
reusing the already-tested `timezone-utils` helpers rather than new tests.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `npm run backend:test` exits 0; 4 new list_tasks tests pass
- [ ] `grep -n "type === 'today' || params.type === 'upcoming'" backend/modules/mcp/tools/taskTools.js` → no matches
- [ ] `grep -n "getTodayBoundsInUTC\|getUpcomingRangeInUTC" backend/modules/mcp/tools/taskTools.js` → both present
- [ ] `npm run backend:lint` exits 0
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The type-filter block or tool schema doesn't match the excerpts (drift —
  plan 010 also edits this file; rebase and re-check).
- An existing test asserts today/upcoming returns undated or far-future
  tasks (it embodied the bug — report, don't silently rewrite it).
- `context.user.timezone` is undefined in the MCP test harness user —
  `getSafeTimezone` should absorb it (falls back to UTC); if tests still
  fail on timezone, report rather than hardcoding offsets.

## Maintenance notes

- If MCP later gains virtual recurring expansion (parity with REST
  Upcoming), these predicates move into shared query builders — consider
  extracting to `queries/query-builders.js` at that point rather than
  duplicating further.
- The `status NOT IN (2, 6)` set mirrors REST semantics of "open"; if new
  statuses are added (see `Task.STATUS` in `backend/models/task.js`), this
  list needs revisiting.
- Reviewer focus: precedence between explicit `params.status` and the
  type-implied status filter (Step 1's `if (!params.status)` guard).
