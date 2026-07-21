# Plan 72: Fix N+1 queries when serializing recurring tasks

> **Status: EXECUTADO** em 2026-07-20 — `serializeTasks` agora faz batch-fetch
> dos UIDs de parent recorrente num único `findAll` + Map, eliminando o
> `findById` por tarefa. A rejeição anterior ("já implementado") estava
> incorreta: o N+1 estava vivo em `serializeTask`. Teste em
> `serialize-recurring-parent-uid.test.js`.

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat e6f61485..HEAD -- backend/modules/tasks/core/serializers.js`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: perf
- **Planned at**: commit `e6f61485`, 2026-07-20

## Why this matters

The `serializeTask` function queries the database to retrieve a parent task's UID when handling recurring tasks. When `serializeTasks` maps over N tasks, this executes N independent database queries. Batching this look-up transforms an N+1 performance bottleneck into a scalable O(1) query set, greatly improving task list rendering time.

## Current state

- The relevant files, each with one line on its role:
  - `backend/modules/tasks/core/serializers.js` — handles converting Task models into API JSON.
- Excerpts of the code as it exists today:
  - `backend/modules/tasks/core/serializers.js:69-78`
    ```javascript
    let recurringParentUid = null;
    if (taskJson.recurring_parent_id) {
        const parentTask = await taskRepository.findById(
            taskJson.recurring_parent_id,
            { attributes: ['uid'] }
        );
        recurringParentUid = parentTask?.uid || null;
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
- `backend/modules/tasks/core/serializers.js`

**Out of scope**:
- Changes to the underlying Task model or schema.

## Git workflow

- Branch: `feat/72-perf-task-serialization`
- Commit per step or per logical unit; message style: `perf(tasks): batch parent task query in serializers (Plan 72)`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Batch fetch parent UIDs
In `serializeTasks`, collect all unique `recurring_parent_id`s from the task list. Fetch them in bulk using `taskRepository.findAll` and build a `Map<id, uid>`. Pass this dictionary as a new parameter to `serializeTask`.

**Verify**: `npm run backend:test` → all pass

### Step 2: Use dictionary in serializeTask
Modify `serializeTask` to check the provided dictionary before falling back to `taskRepository.findById` to ensure backward compatibility for single-task serialization.

**Verify**: `npm run backend:test` → all pass

## Test plan

- Tests should continue to pass. The logic change is transparent to the API shape.

## Done criteria

- [ ] `npm run backend:test` exits 0
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

- The code at the locations in "Current state" doesn't match the excerpts.
- A step's verification fails twice after a reasonable fix attempt.
- The fix appears to require touching an out-of-scope file.
