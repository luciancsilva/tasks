# Plan 011: Remove debug logging from the tasks hot path and batch the recurring-parent uid lookup

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat f071873..HEAD -- backend/modules/tasks/routes.js backend/modules/tasks/operations/completion.js backend/modules/tasks/operations/recurring.js backend/modules/tasks/core/serializers.js`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: perf
- **Planned at**: commit `f071873`, 2026-07-12

## Why this matters

Two cheap wins on the most-hit backend path (`GET /tasks`, `PATCH /task/:uid`):

1. **Debug `console.log` on every request.** The recurring-task expansion
   logs ~5 lines *per recurring task* on every Upcoming request, plus
   whole-array dumps, plus logs on every task update and completion.
   `console.log` is synchronous I/O on the single Node thread — on the
   NAS-class deployments tududi targets, this measurably stalls requests and
   floods logs.
2. **N+1 query in task serialization.** Every task with a
   `recurring_parent_id` triggers its own DB query just to resolve the
   parent's `uid`, so a list of R recurring instances issues R extra queries.
   A batching pattern already exists in the same function for move-counts;
   this lookup just doesn't use it.

## Current state

- `backend/modules/tasks/routes.js` — the tasks module's HTTP routes
  (~1056 lines; known god-module, do NOT refactor it here).
  `console.log` calls to remove, all verified present at commit `f071873`:
  - Line 133: `console.log('[DEBUG] Processing recurring task:', {...})` —
    per recurring task, inside `expandRecurringTasks`.
  - Line 148, 164: `console.log('[DEBUG] Task is completed...')` variants.
  - Line 181: `console.log('[DEBUG] Starting from date:', startFrom)`.
  - Line 188: `console.log('[DEBUG] Generated occurrences:', occurrences.length)`.
  - Lines 254-256, 278: `[DEBUG] Expanding recurring tasks for /upcoming`,
    `Total tasks before expansion`, a multi-line array dump, `after expansion`.
  - Lines 811, 818, 831, 836: `[routes.js] Before/After task.update ...`
    inside `PATCH /task/:uid`.
- `backend/modules/tasks/operations/completion.js` — lines 10, 19, 25, 28:
  `[handleCompletionStatus]` logs on every status change.
- `backend/modules/tasks/operations/recurring.js` — lines 100, 147:
  `Weekly recurrence check:` and `calculateNextIterations:` object dumps.
- `backend/services/logService.js` — the repo's "logger" (all 9 lines of it):
  ```js
  const logError = console.error;
  const logInfo = console.log;
  const logDebug = console.log;
  module.exports = { logError, logInfo, logDebug };
  ```
  `logDebug` is NOT env-gated, so switching the logs to `logDebug` would
  change nothing. Deletion is the fix. Keep `logError` usages intact
  everywhere.

- `backend/modules/tasks/core/serializers.js` — task serialization.
  - **The N+1** (lines 69-78):
    ```js
    let recurringParentUid = null;
    if (taskJson.recurring_parent_id) {
        const parentTask = await taskRepository.findById(
            taskJson.recurring_parent_id,
            { attributes: ['uid'] }
        );
        recurringParentUid = parentTask?.uid || null;
    }
    ```
    Consumed at line 87: `recurring_parent_uid: recurringParentUid,`.
  - **The batching pattern to mirror** (lines 135-148):
    ```js
    async function serializeTasks(tasks, userTimezone = 'UTC', options = {}) {
        if (!tasks || tasks.length === 0) return [];
        const taskIds = tasks.map((task) => task.id);
        const moveCountMap = await getTaskTodayMoveCounts(taskIds);
        return await Promise.all(
            tasks.map((task) =>
                serializeTask(task, userTimezone, options, moveCountMap)
            )
        );
    }
    ```
    `serializeTask(task, userTimezone, options, moveCountMap)` already takes
    the batch map as its 4th parameter; `taskRepository.findById` is defined
    in `backend/modules/tasks/repository.js:8`.
  - `serializeTask` is exported and also called directly (single-task
    responses, e.g. `taskTools.js:372`), so the per-task fallback query must
    remain when no map is supplied.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Backend tests (all) | `npm run backend:test` | exit 0 |
| Tasks tests only | `cd backend && npx cross-env NODE_ENV=test npx jest tasks` | all pass |
| Lint | `npm run backend:lint` | exit 0 |

## Scope

**In scope** (the only files you should modify):
- `backend/modules/tasks/routes.js` (log deletions only — no logic changes)
- `backend/modules/tasks/operations/completion.js` (log deletions only)
- `backend/modules/tasks/operations/recurring.js` (log deletions only)
- `backend/modules/tasks/core/serializers.js` (batch the parent-uid lookup)
- The serializer's test file if one exists (check
  `backend/tests/**/serializers*`), else
  `backend/tests/unit/tasks/serializers.test.js` (create)

**Out of scope** (do NOT touch, even though they look related):
- Any `console.error` / `logError` call — error logging stays.
- `backend/services/logService.js` — upgrading it to a gated logger is a
  worthwhile separate change; not this plan.
- Refactoring `routes.js` structure, the in-memory pagination, the
  permission-cache threading — all separately audited findings.
- Any `console.log` outside the three listed files.

## Git workflow

- Branch: `advisor/011-tasks-hot-path-cleanup`
- Commit style: conventional commits; suggest two commits:
  `perf(tasks): remove debug logging from request hot paths` and
  `perf(tasks): batch recurring-parent uid lookup in serializeTasks`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Delete the debug logs

Remove the `console.log` statements listed in "Current state" from the three
files. Delete the whole statement including its object argument — do not
leave orphaned braces. Do NOT remove `console.error`.

**Verify**:
`grep -n "console.log" backend/modules/tasks/routes.js backend/modules/tasks/operations/completion.js backend/modules/tasks/operations/recurring.js`
→ no matches. Then `npm run backend:lint` → exit 0 (catches syntax damage).

### Step 2: Batch the recurring-parent uid lookup

In `backend/modules/tasks/core/serializers.js`:

1. In `serializeTasks`, after computing `moveCountMap`, build a parent-uid
   map with **one** query:
   ```js
   const parentIds = [
       ...new Set(
           tasks
               .map((t) => (t.toJSON ? t.toJSON() : t).recurring_parent_id)
               .filter(Boolean)
       ),
   ];
   let parentUidMap = {};
   if (parentIds.length > 0) {
       const parents = await Task.findAll({
           where: { id: { [Op.in]: parentIds } },
           attributes: ['id', 'uid'],
           raw: true,
       });
       parentUidMap = Object.fromEntries(parents.map((p) => [p.id, p.uid]));
   }
   ```
   Add `Task` and `Op` to the imports if not present (check the top of the
   file; `sequelize` models come from `../../../models`).
2. Extend `serializeTask`'s signature with a 5th parameter
   `parentUidMap = null` and change lines 69-78 to use it when provided:
   ```js
   let recurringParentUid = null;
   if (taskJson.recurring_parent_id) {
       if (parentUidMap && taskJson.recurring_parent_id in parentUidMap) {
           recurringParentUid = parentUidMap[taskJson.recurring_parent_id] || null;
       } else {
           const parentTask = await taskRepository.findById(
               taskJson.recurring_parent_id,
               { attributes: ['uid'] }
           );
           recurringParentUid = parentTask?.uid || null;
       }
   }
   ```
   (Fallback keeps single-task callers like `mcp/tools/taskTools.js:372`
   working unchanged.)
3. Pass the map from `serializeTasks`:
   `serializeTask(task, userTimezone, options, moveCountMap, parentUidMap)`.

**Verify**: `cd backend && npx cross-env NODE_ENV=test npx jest tasks` → pass.

### Step 3: Test the batching

Add tests (existing serializer test file if present, else create
`backend/tests/unit/tasks/serializers.test.js`, modeled on the nearest unit
test under `backend/tests/unit/`):

1. `serializeTasks` on a recurring parent + 2 child instances returns
   `recurring_parent_uid` equal to the parent's uid on both children.
2. `serializeTask` called directly (no map) on a child instance still
   resolves `recurring_parent_uid` (fallback path).
3. Query-count assertion if cheap: spy on `Task.findAll`/repository to assert
   one parent lookup for N children. If the test infra makes this awkward,
   skip the spy — the two behavioral tests suffice.

**Verify**: `npm run backend:test` → exit 0, new tests pass.

## Test plan

Covered in Step 3. Behavioral equivalence is the bar: `recurring_parent_uid`
values identical before/after. The X-Query-Count response header
(`routes.js` emits it) can be used for manual before/after comparison but is
not a test gate.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `grep -rn "console.log" backend/modules/tasks/` → no matches
      (console.error may remain)
- [ ] `npm run backend:test` exits 0; new serializer tests pass
- [ ] `npm run backend:lint` exits 0
- [ ] `grep -n "parentUidMap" backend/modules/tasks/core/serializers.js` →
      matches in both `serializeTasks` and `serializeTask`
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- Log lines listed in "Current state" are absent or moved (drift) — re-grep
  and reconcile before deleting anything.
- Any test asserts on console output from these files (search
  `backend/tests` for `[DEBUG]` / `handleCompletionStatus` before deleting).
- Serializer tests reveal `recurring_parent_uid` was relied on to be resolved
  through the repository (e.g. a mock intercepts `taskRepository.findById`) —
  adjust the test setup, not the production fallback; report if unclear.

## Maintenance notes

- If a proper env-gated logger lands later (`logService.js` upgrade), new
  debug logging should go through it — never bare `console.log` in
  `backend/modules/tasks/`.
- If pagination is ever pushed into SQL for `GET /tasks` (separately audited
  finding), `serializeTasks` still receives the page's tasks — the batching
  here remains valid.
- Reviewer focus: Step 1 must be pure deletions (diff should remove lines
  only); Step 2's fallback path keeps single-task serialization intact.
