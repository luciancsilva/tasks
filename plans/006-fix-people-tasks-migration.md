# Plan 006: Make the `add-people-to-tasks` migration idempotent (fix Docker crash-loop part 2)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 51b4354..HEAD -- backend/migrations/20260630000002-add-people-to-tasks.js`
> If this file changed since the plan was written, compare the "Current state"
> excerpt against the live code before proceeding; on a mismatch, treat it as a
> STOP condition.

## Status

- **Priority**: P1 (urgent — resolves second part of production crash-loop on fresh Docker installs)
- **Effort**: S
- **Risk**: LOW
- **Depends on**: 005
- **Category**: bug
- **Planned at**: commit `51b4354`, 2026-07-12

## Why this matters

Following the fix in Plan 005, a fresh Docker install still crash-loops on `20260630000002-add-people-to-tasks.js` because of another raw, unguarded `addColumn('tasks', 'assigned_to', ...)` call.

Since `tasks.assigned_to` and `tasks.involves` are already defined on the task model, `sequelize.sync({ force: true })` in `db-init.js` creates them on first boot. The subsequent migration replay fails with:

```
ERROR: SQLITE_ERROR: duplicate column name: assigned_to
```

We must modify this migration to use the repository's `safeAddColumns` and `safeAddIndex` helpers to make it idempotent.

## Current state

- **The broken migration** — `backend/migrations/20260630000002-add-people-to-tasks.js` (entire file):

```js
'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.addColumn('tasks', 'assigned_to', {
            type: Sequelize.STRING(15),
            allowNull: true,
            defaultValue: null,
            references: {
                model: 'people',
                key: 'uid',
            },
            onUpdate: 'CASCADE',
            onDelete: 'SET NULL',
        });

        await queryInterface.addColumn('tasks', 'involves', {
            type: Sequelize.TEXT,
            allowNull: true,
            defaultValue: null,
        });

        await queryInterface.addIndex('tasks', ['assigned_to'], {
            name: 'tasks_assigned_to_idx',
        });
    },

    async down(queryInterface) {
        await queryInterface.removeIndex('tasks', 'tasks_assigned_to_idx');
        await queryInterface.removeColumn('tasks', 'involves');
        await queryInterface.removeColumn('tasks', 'assigned_to');
    },
};
```

## Commands you will need

| Purpose                     | Command                                                        | Expected on success               |
|-----------------------------|----------------------------------------------------------------|-----------------------------------|
| Reproduce the Docker path   | `cd backend && NODE_ENV=development node scripts/db-init.js && NODE_ENV=development node scripts/db-migrate.js` | **before fix**: fails on `assigned_to` duplicate; **after fix**: completes all migrations, exit 0 |
| Migration status            | `npm run migration:status`                                     | `20260630000002` listed as up     |
| Lint (backend)              | `npm run backend:lint`                                         | exit 0                            |
| Backend tests               | `npm run backend:test`                                         | all pass, exit 0                  |

WARNING: Only run the reproduction command against a throwaway **development** database.

## Scope

**In scope** (the only file you should modify):
- `backend/migrations/20260630000002-add-people-to-tasks.js`

**Out of scope** (do NOT touch):
- `backend/scripts/db-init.js`
- `backend/models/task.js`
- Any other migration file.

## Git workflow

- Branch: `advisor/006-fix-people-tasks-migration`
- Commit style: Conventional Commits: `fix(migrations): make add-people-to-tasks idempotent`

## Steps

### Step 1: Rewrite the migration to use the safe helpers

Replace the contents of `backend/migrations/20260630000002-add-people-to-tasks.js` using the safe helpers:

```js
'use strict';

const { safeAddColumns, safeAddIndex } = require('../utils/migration-utils');

module.exports = {
    async up(queryInterface, Sequelize) {
        await safeAddColumns(queryInterface, 'tasks', [
            {
                name: 'assigned_to',
                definition: {
                    type: Sequelize.STRING(15),
                    allowNull: true,
                    defaultValue: null,
                    references: {
                        model: 'people',
                        key: 'uid',
                    },
                    onUpdate: 'CASCADE',
                    onDelete: 'SET NULL',
                },
            },
            {
                name: 'involves',
                definition: {
                    type: Sequelize.TEXT,
                    allowNull: true,
                    defaultValue: null,
                },
            },
        ]);

        await safeAddIndex(queryInterface, 'tasks', ['assigned_to'], {
            name: 'tasks_assigned_to_idx',
        });
    },

    async down(queryInterface) {
        await queryInterface.removeIndex('tasks', 'tasks_assigned_to_idx');
        await queryInterface.removeColumn('tasks', 'involves');
        await queryInterface.removeColumn('tasks', 'assigned_to');
    },
};
```

**Verify**: `npm run backend:lint` → exit 0.

### Step 2: Reproduce the fresh-install path and confirm it completes

Against the development database:

```bash
cd backend && NODE_ENV=development node scripts/db-init.js && NODE_ENV=development node scripts/db-migrate.js
```

**Verify**: Exits 0 and all migrations (including `20260630000002` and all subsequent migrations) complete successfully.

### Step 3: Confirm idempotency on a second run

Run migrations again:

```bash
cd backend && NODE_ENV=development node scripts/db-migrate.js
```

**Verify**: Exits 0.

### Step 4: Run tests

**Verify**: `npm run backend:test` → exit 0.

## Done criteria

- [ ] `backend/migrations/20260630000002-add-people-to-tasks.js` uses `safeAddColumns` + `safeAddIndex`
- [ ] Fresh init + migrate commands run and exit 0
- [ ] Re-run migrations command exits 0
- [ ] `npm run backend:lint` exits 0
- [ ] `npm run backend:test` exits 0
- [ ] `plans/README.md` updated with Plan 006 row

## STOP conditions

- The migration file does not match the "Current state" excerpt.
- Migration fails on a different file after this fix.
