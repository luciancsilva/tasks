# Plan 009: Fix backup restore so imports with task attachments no longer fail

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat f071873..HEAD -- backend/services/backupService.js backend/tests/unit/services/backupService.test.js`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `f071873`, 2026-07-12

## Why this matters

Backup **import is broken for any user who ever attached a file to a task**.
The restore code creates `TaskAttachment` rows using field names
(`file_name`, `file_url`, `file_type`) that do not exist on the model; the
model's real columns (`original_filename`, `stored_filename`, `mime_type`,
`file_path`) are all `allowNull: false`, so Sequelize throws a validation
error — and because the entire import runs in one transaction, **the whole
restore rolls back**. Backup/restore is the disaster-recovery path; it must
not fail precisely for the users with the most data.

## Current state

- `backend/services/backupService.js` — export and import logic.
  - **Export** (lines 201-211) serializes attachments via `toJSON()`, i.e.
    with the **real model field names**:

    ```js
    // backend/services/backupService.js:201-211
    tasks: tasks.map((task) => {
        const taskData = task.toJSON();
        taskData.tag_uids = (task.Tags || []).map((tag) => tag.uid);
        taskData.completions = taskData.Completions || [];
        taskData.attachments = taskData.Attachments || [];
        ...
    ```

    So each exported attachment object contains `uid`, `task_id`, `user_id`,
    `original_filename`, `stored_filename`, `file_size`, `mime_type`,
    `file_path`, timestamps.

  - **Import** (lines 463-481) writes fields that don't exist on the model:

    ```js
    // backend/services/backupService.js:468-480
    for (const attachment of taskData.attachments) {
        await TaskAttachment.create(
            {
                task_id: newTask.id,
                user_id: userId,
                file_name: attachment.file_name,       // ← not a model field; undefined
                file_url: attachment.file_url,         // ← not a model field; undefined
                file_size: attachment.file_size,
                file_type: attachment.file_type,       // ← not a model field; undefined
            },
            { transaction }
        );
    }
    ```

    `original_filename`, `stored_filename`, `mime_type`, `file_path` are all
    missing → `notNull` violation → transaction rollback → `importUserData`
    throws.

  - The import transaction starts at line 241 (`sequelize.transaction()`);
    everything shares it.

- `backend/models/task_attachment.js` — the model. Relevant excerpt:

  ```js
  // backend/models/task_attachment.js:13-54
  uid: { type: DataTypes.STRING, allowNull: false, unique: true, defaultValue: uid },
  task_id: { type: DataTypes.INTEGER, allowNull: false, ... },
  user_id: { type: DataTypes.INTEGER, allowNull: false, ... },
  original_filename: { type: DataTypes.STRING, allowNull: false },
  stored_filename:   { type: DataTypes.STRING, allowNull: false },
  file_size:         { type: DataTypes.INTEGER, allowNull: false },
  mime_type:         { type: DataTypes.STRING, allowNull: false },
  file_path:         { type: DataTypes.STRING, allowNull: false },
  ```

- The canonical example of creating an attachment correctly:
  `backend/modules/tasks/attachments.js:128-137` (the upload route).

- Physical files are **not** included in the backup JSON — only DB rows. A
  restored attachment row may therefore point at a `file_path` that doesn't
  exist on this disk. That is pre-existing behavior and out of scope; the
  download route (`attachments.js:265-307`) will fail for that file only,
  not crash the app.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Backend tests (all) | `npm run backend:test` | exit 0 |
| Backend tests (one file) | `cd backend && npx cross-env NODE_ENV=test npx jest tests/unit/services/backupService.test.js` | all pass |
| Lint | `npm run backend:lint` | exit 0 |

## Scope

**In scope** (the only files you should modify):
- `backend/services/backupService.js` (only the attachment block, lines ~463-481)
- `backend/tests/unit/services/backupService.test.js` (create)

**Out of scope** (do NOT touch, even though they look related):
- The stale-numeric-ID FK remapping elsewhere in `importUserData`
  (`area_id` lookup at lines 341-347, `project_id` at 400-407, parent/recurring
  remap at 485-528) — real, separate finding; a future plan covers it. Fixing
  it here would blow the diff and the risk profile.
- Bundling physical files into backups.
- `backend/models/task_attachment.js` — the model is correct.
- The export side (lines 185-229) — it already exports correct field names.

## Git workflow

- Branch: `advisor/009-fix-backup-restore-attachments`
- Commit style: conventional commits, e.g.
  `fix(backup): restore task attachments with correct model fields`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Fix the attachment creation block

In `backend/services/backupService.js` (lines ~468-480), replace the field
mapping with the real model fields, preserving the original `uid` so re-imports
stay idempotent-friendly:

```js
for (const attachment of taskData.attachments) {
    await TaskAttachment.create(
        {
            uid: attachment.uid,
            task_id: newTask.id,
            user_id: userId,
            original_filename: attachment.original_filename,
            stored_filename: attachment.stored_filename,
            file_size: attachment.file_size,
            mime_type: attachment.mime_type,
            file_path: attachment.file_path,
        },
        { transaction }
    );
}
```

Guard against half-broken backups produced by older exports: skip (and count
nothing for) attachment objects missing any of the four required string
fields, rather than crashing the whole import. Wrap with:

```js
if (
    !attachment.original_filename ||
    !attachment.stored_filename ||
    !attachment.mime_type ||
    !attachment.file_path
) {
    continue; // legacy/malformed attachment entry — skip, don't fail the restore
}
```

**Verify**: `npm run backend:lint` → exit 0.

### Step 2: Write the round-trip test

Create `backend/tests/unit/services/backupService.test.js`. Use
`backend/tests/unit/services/rolesService.test.js` as the structural pattern
(NODE_ENV=test Jest, models from `../../../models`, helpers from
`backend/tests/helpers/`). Cases:

1. **Round trip with attachment**: create a user, a task, and a
   `TaskAttachment` (use the field values the upload route would set, e.g.
   `original_filename: 'report.pdf'`, `stored_filename: 'task-123-456.pdf'`,
   `file_size: 100`, `mime_type: 'application/pdf'`,
   `file_path: 'tasks/task-123-456.pdf'`). Call `exportUserData(user.id)`,
   then `importUserData(secondUser.id, exported)` for a **fresh second user**.
   Assert: import resolves, `stats.tasks.created === 1`, and the second user
   has one `TaskAttachment` row with `original_filename === 'report.pdf'` and
   the same `uid` as the exported one.
2. **Regression shape**: import a backup whose attachment entry uses the old
   broken keys (`file_name`/`file_url`/`file_type` only). Assert the import
   still **resolves** (attachment skipped, task created) instead of rejecting.
3. **No attachments**: plain task round trip still works (guards against
   regressions in the surrounding loop).

**Verify**: `cd backend && npx cross-env NODE_ENV=test npx jest tests/unit/services/backupService.test.js` → 3 tests pass.

### Step 3: Full suite

**Verify**: `npm run backend:test` → exit 0.

## Test plan

Covered in Step 2 — new file `backend/tests/unit/services/backupService.test.js`,
3 cases (happy round trip, legacy-keys tolerance, no-attachment control),
patterned after `backend/tests/unit/services/rolesService.test.js`. No backup
tests exist today (verified during planning), so this also establishes the
file future backup fixes will extend.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `npm run backend:test` exits 0; 3 new tests in
      `tests/unit/services/backupService.test.js` exist and pass
- [ ] `grep -n "file_name\|file_url\|file_type" backend/services/backupService.js`
      shows no matches inside the attachment-create block (hits in the
      *backup-file management* section around lines 734-878 are a different
      `file_path` concept and must remain)
- [ ] `npm run backend:lint` exits 0
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The import block at `backupService.js:463-481` doesn't match the excerpt
  (drift).
- `exportUserData` turns out NOT to include the model field names (i.e. some
  transform renames them before line 206) — re-verify export output in a test
  first; if names differ, report instead of guessing a mapping.
- The round-trip test fails on something *other* than attachments (e.g. the
  known stale-FK remap issues) — report; do not expand scope to fix those here.

## Maintenance notes

- A future plan will fix `importUserData`'s numeric-ID FK remapping
  (`area_id`/`project_id`/parent/recurring lookups use pre-export numeric ids
  and are partly unscoped by user). Whoever does that should extend the test
  file created here.
- If backups ever start bundling physical files, the skip-guard in Step 1
  is where file extraction/copy would hook in.
- Reviewer focus: confirm `uid: attachment.uid` doesn't collide on merge
  re-imports into the *same* user (the task-level `existingTask` check at
  line 390-397 skips the whole task, including attachments, so it shouldn't).
