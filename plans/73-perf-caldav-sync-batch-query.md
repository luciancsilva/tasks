# Plan 73: Batch queries in CalDAV sync loop

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat e6f61485..HEAD -- backend/modules/caldav/sync/merge-phase.js`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: perf
- **Planned at**: commit `e6f61485`, 2026-07-20

## Why this matters

During the CalDAV sync merge phase, the `_handleCreateOrUpdate` and `_handleDeletion` methods execute independent `Task.findOne` queries within a `for...of` loop over `changedTasks`. This triggers N+1 sequential database queries, degrading sync performance and holding transactions open longer than necessary. Batching these lookups minimizes I/O latency and database contention.

## Current state

- The relevant files, each with one line on its role:
  - `backend/modules/caldav/sync/merge-phase.js` — handles syncing changed CalDAV data into the database.
- Excerpts of the code as it exists today:
  - `backend/modules/caldav/sync/merge-phase.js:24-40`
    ```javascript
        for (const change of changedTasks) {
            try {
                if (change.action === 'delete') {
                    await this._handleDeletion(
                        change,
                        calendar,
                        dryRun,
                        results
                    );
                } else if (change.action === 'create_or_update') {
                    await this._handleCreateOrUpdate(
                        change,
                        calendar,
                        dryRun,
                        results
                    );
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
- `backend/modules/caldav/sync/merge-phase.js`

**Out of scope**:
- Push phase logic.

## Git workflow

- Branch: `feat/73-perf-caldav-sync-batch`
- Commit per step or per logical unit; message style: `perf(caldav): batch task queries in merge phase (Plan 73)`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Bulk fetch tasks before loop
In `execute` within `merge-phase.js`, iterate over `changedTasks` to collect `change.uid` values. Perform a single bulk fetch using `Task.findAll({ where: { uid: uids } })`. Create a lookup Map mapping UID to Task.

**Verify**: `npm run backend:test` → all pass

### Step 2: Inject pre-fetched tasks
Update `_handleDeletion` and `_handleCreateOrUpdate` to receive the lookup Map or the specific pre-fetched task instead of fetching it via `findOne` internally. Remove the redundant `findOne` calls.

**Verify**: `npm run backend:test` → all pass

## Test plan

- Ensure existing CalDAV integration tests continue to pass. No behavioral change, just optimization.

## Done criteria

- [ ] `npm run backend:test` exits 0
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

- The code at the locations in "Current state" doesn't match the excerpts.
- A step's verification fails twice after a reasonable fix attempt.
- The fix appears to require touching an out-of-scope file.
