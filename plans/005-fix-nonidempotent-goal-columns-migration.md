# Plan 005: Make the `add-goal-columns-to-projects` migration idempotent (fix Docker crash-loop)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat a55e4ad..HEAD -- backend/migrations/20260624000002-add-goal-columns-to-projects.js`
> If this file changed since the plan was written, compare the "Current state"
> excerpt against the live code before proceeding; on a mismatch, treat it as a
> STOP condition.

## Status

- **Priority**: P1 (most urgent — production crash-loop on fresh Docker installs)
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `a55e4ad`, 2026-07-11

## Why this matters

A fresh Docker install crash-loops and never becomes usable. On first run the
container entrypoint (1) creates the schema with `db-init` — which runs
`sequelize.sync({ force: true })` and therefore creates **all** current model
columns, including `projects.goal_id` — and then (2) replays every migration
from an empty `SequelizeMeta`. Migration
`20260624000002-add-goal-columns-to-projects` uses a **raw, unguarded**
`addColumn('projects', 'goal_id', …)`, so it tries to add a column that
`db-init` already created and throws:

```
ERROR: SQLITE_ERROR: duplicate column name: goal_id
```

That aborts the migration run. Every migration ordered **after** it never
applies — including `20260626000001-add-ai-brief-cache-to-users`, which adds
`users.ai_daily_brief`. The entrypoint then tries to create the initial user and
fails with:

```
❌ Error creating user: SQLITE_ERROR: no such column: ai_daily_brief
```

The container restarts and repeats forever (the logs show the backup +
migrate + fail cycle looping every ~2 seconds). Nearly every other column-adding
migration in this repo is already idempotent — either a manual `describeTable`
guard or the repo's `safeAddColumns` / `safeAddIndex` helpers. This one migration
missed the convention. Fixing it unblocks the whole chain.

## Current state

- **The broken migration** — `backend/migrations/20260624000002-add-goal-columns-to-projects.js`
  (entire file), raw unguarded adds:

```js
'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.addColumn('projects', 'goal_id', {
            type: Sequelize.INTEGER,
            allowNull: true,
            references: {
                model: 'goals',
                key: 'id',
            },
            onUpdate: 'CASCADE',
            onDelete: 'SET NULL',
        });

        await queryInterface.addColumn('projects', 'is_maintenance', {
            type: Sequelize.BOOLEAN,
            allowNull: false,
            defaultValue: false,
        });

        await queryInterface.addIndex('projects', ['goal_id'], {
            name: 'projects_goal_id_idx',
        });
    },

    async down(queryInterface) {
        await queryInterface.removeIndex('projects', 'projects_goal_id_idx');
        await queryInterface.removeColumn('projects', 'is_maintenance');
        await queryInterface.removeColumn('projects', 'goal_id');
    },
};
```

- **Why `db-init` creates the column** — `backend/scripts/db-init.js` runs
  `await sequelize.sync({ force: true })`, and `backend/models/project.js:87-99`
  defines both `goal_id` and `is_maintenance` on the model. So on a fresh install
  the columns exist *before* migrations run.

- **The repo's idempotency helpers** — `backend/utils/migration-utils.js` exports
  `safeAddColumns` and `safeAddIndex`, which check existence before acting:

```js
// safeAddColumns: describeTable(table), then addColumn only if !(name in tableInfo)
// safeAddIndex:   showIndex(table),   then addIndex   only if not already present
```

- **The exemplar to copy** — `backend/migrations/20260623000001-add-area-id-to-tasks.js`
  is the sibling migration (added one commit earlier) that does the exact same
  shape (nullable FK column + index) the *right* way:

```js
'use strict';

const { safeAddColumns, safeAddIndex } = require('../utils/migration-utils');

module.exports = {
    async up(queryInterface, Sequelize) {
        await safeAddColumns(queryInterface, 'tasks', [
            {
                name: 'area_id',
                definition: {
                    type: Sequelize.INTEGER,
                    allowNull: true,
                    references: { model: 'areas', key: 'id' },
                    onUpdate: 'CASCADE',
                    onDelete: 'SET NULL',
                },
            },
        ]);

        await safeAddIndex(queryInterface, 'tasks', ['area_id'], {
            name: 'tasks_area_id_idx',
        });
    },

    async down(queryInterface) {
        await queryInterface.removeIndex('tasks', 'tasks_area_id_idx');
        await queryInterface.removeColumn('tasks', 'area_id');
    },
};
```

- Convention notes: migrations are CommonJS, filenames are timestamp-prefixed and
  **must not** be renamed (the timestamp is the applied-migration key in
  `SequelizeMeta`). Migration commands run from `backend/` via `sequelize-cli`.

## Commands you will need

| Purpose                     | Command                                                        | Expected on success               |
|-----------------------------|----------------------------------------------------------------|-----------------------------------|
| Reproduce the Docker path   | `cd backend && NODE_ENV=development node scripts/db-init.js && NODE_ENV=development node scripts/db-migrate.js` | **before fix**: fails `duplicate column name: goal_id`; **after fix**: completes all migrations, exit 0 |
| Migration status            | `npm run migration:status`                                     | `20260624000002` listed as up     |
| Lint (backend)              | `npm run backend:lint`                                         | exit 0                            |
| Backend tests               | `npm run backend:test`                                         | all pass, exit 0                  |

WARNING: `db-init.js` runs `sync({ force: true })` and **drops all data in the
target database**. Only run the reproduction command against a throwaway
**development** database (the default dev sqlite), never a real one. Confirm
`NODE_ENV=development` and that no production `DB_FILE` env var is set in your
shell before running it.

## Scope

**In scope** (the only file you should modify):
- `backend/migrations/20260624000002-add-goal-columns-to-projects.js`

**Out of scope** (do NOT touch):
- `backend/scripts/db-init.js` and `scripts/docker-entrypoint.sh` — the deeper
  design question of running `sync({force:true})` **and** migrations on first boot
  is real but separate; do not change the boot sequence here. This plan only makes
  the one migration safe against that sequence (matching every peer migration).
- `backend/models/project.js` — do not change the model.
- `backend/utils/migration-utils.js` — use the helpers as-is; do not modify them.
- Any other migration file. Do NOT rename or renumber this migration file.
- `20260626000001-add-ai-brief-cache-to-users` and later migrations — they are
  already fine; they only failed because they never ran. Do not touch them.

## Git workflow

- Branch: `advisor/005-fix-goal-columns-migration`
- Commit style: Conventional Commits. Suggested:
  `fix(migrations): make add-goal-columns-to-projects idempotent`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Rewrite the migration to use the safe helpers

Replace the contents of
`backend/migrations/20260624000002-add-goal-columns-to-projects.js` so the `up`
path guards every add, following the `20260623000001` exemplar. Keep both
columns (`goal_id`, `is_maintenance`), the FK options, and the index
(`projects_goal_id_idx`) identical. Target shape:

```js
'use strict';

const { safeAddColumns, safeAddIndex } = require('../utils/migration-utils');

module.exports = {
    async up(queryInterface, Sequelize) {
        await safeAddColumns(queryInterface, 'projects', [
            {
                name: 'goal_id',
                definition: {
                    type: Sequelize.INTEGER,
                    allowNull: true,
                    references: { model: 'goals', key: 'id' },
                    onUpdate: 'CASCADE',
                    onDelete: 'SET NULL',
                },
            },
            {
                name: 'is_maintenance',
                definition: {
                    type: Sequelize.BOOLEAN,
                    allowNull: false,
                    defaultValue: false,
                },
            },
        ]);

        await safeAddIndex(queryInterface, 'projects', ['goal_id'], {
            name: 'projects_goal_id_idx',
        });
    },

    async down(queryInterface) {
        await queryInterface.removeIndex('projects', 'projects_goal_id_idx');
        await queryInterface.removeColumn('projects', 'is_maintenance');
        await queryInterface.removeColumn('projects', 'goal_id');
    },
};
```

Leave `down` unchanged from the original.

**Verify**: `npm run backend:lint` → exit 0 (no errors on the file).

### Step 2: Reproduce the fresh-install path and confirm it now completes

This is the exact sequence the Docker entrypoint runs on first boot. Against the
**development** database only:

```
cd backend && NODE_ENV=development node scripts/db-init.js && NODE_ENV=development node scripts/db-migrate.js
```

**Verify**: the command exits 0 and the migration output shows
`20260624000002-add-goal-columns-to-projects: migrated` with **no**
`duplicate column name: goal_id` error, and continues through the later
migrations (e.g. `20260626000001-add-ai-brief-cache-to-users`,
`20260630000001-create-people`) to completion.

### Step 3: Confirm idempotency on a second run

Run the migration step again (without re-initing) to prove it is safe to
re-apply on an already-migrated DB:

```
cd backend && NODE_ENV=development node scripts/db-migrate.js
```

**Verify**: exits 0, no `duplicate column name` error (already-applied migrations
are simply skipped by `SequelizeMeta`; the guard also protects a manual re-run).

### Step 4: Backend suite stays green

**Verify**: `npm run backend:test` → exit 0, all pass. In particular any tests
under `backend/tests/**/goals*` or `projects*` still pass.

## Test plan

- No new unit test is strictly required (this is a migration-idempotency fix; the
  reproduction in Step 2 is the regression check). If a lightweight guard is
  desired, add an assertion-style check only if a migration test harness already
  exists under `backend/tests/` — do NOT invent a new harness for this plan.
- Primary regression evidence: Step 2 (fresh init + migrate) completes with no
  duplicate-column error; Step 3 (re-run) is a no-op.
- Structural reference for "the right way": `backend/migrations/20260623000001-add-area-id-to-tasks.js`.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `backend/migrations/20260624000002-add-goal-columns-to-projects.js` imports
      and uses `safeAddColumns` + `safeAddIndex`; no raw `queryInterface.addColumn`
      in its `up`
- [ ] `cd backend && NODE_ENV=development node scripts/db-init.js && NODE_ENV=development node scripts/db-migrate.js`
      exits 0 with no `duplicate column name: goal_id`
- [ ] A second `node scripts/db-migrate.js` exits 0 (idempotent)
- [ ] `npm run backend:lint` exits 0
- [ ] `npm run backend:test` exits 0
- [ ] `git status` shows only the one migration file modified
- [ ] `plans/README.md` status row for 005 updated

## STOP conditions

Stop and report back (do not improvise) if:

- The migration file does not match the "Current state" excerpt (drift since this
  plan was written).
- After the fix, `db-migrate` fails on a **different** migration than
  `20260624000002` — that means there is a second non-idempotent migration; report
  which one and its error rather than fixing it here (it may deserve its own plan).
- The reproduction in Step 2 cannot run because a production `DB_FILE`/`NODE_ENV`
  is set in the environment — do NOT run `db-init.js` against a non-dev database;
  stop and report.
- `is_maintenance` turns out to be `allowNull: false` with existing NULL rows on
  some install (would make the guarded add fail on a partially-migrated DB) — report
  the state; do not silently change the column definition.

## Maintenance notes

- Broader follow-up (separate plan, deliberately out of scope): the entrypoint
  runs `db-init` (`sync({force:true})`) **and** the migration chain on first boot,
  which is why any non-idempotent migration crash-loops the container. Options to
  evaluate later: skip `sync` when migrations are the source of truth, or make
  `db-init` migration-aware. This plan only hardens the one migration that broke.
- Convention to enforce in review going forward: every new column/index migration
  must use `safeAddColumns` / `safeAddIndex` (or a `describeTable` guard), because
  the fresh-install path applies them against an already-synced schema.
- Reviewer should confirm the column definitions and index name are byte-for-byte
  the same as the original (only the add mechanism changed), so already-migrated
  production DBs see no schema difference.
