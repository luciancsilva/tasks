# Plan 007: Make the `add-color-to-people` migration idempotent (fix Docker crash-loop part 3)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 51b4354..HEAD -- backend/migrations/20260630000003-add-color-to-people.js`
> If this file changed since the plan was written, compare the "Current state"
> excerpt against the live code before proceeding; on a mismatch, treat it as a
> STOP condition.

## Status

- **Priority**: P1 (urgent — resolves third part of production crash-loop on fresh Docker installs)
- **Effort**: S
- **Risk**: LOW
- **Depends on**: 006
- **Category**: bug
- **Planned at**: commit `51b4354`, 2026-07-12

## Why this matters

Following the fixes in Plan 005 and 006, a fresh Docker install still crash-loops on `20260630000003-add-color-to-people.js` because of another raw, unguarded `addColumn('people', 'color', ...)` call.

Since `people.color` is already defined on the model, `sequelize.sync({ force: true })` in `db-init.js` creates it on first boot. The subsequent migration replay fails with:

```
ERROR: SQLITE_ERROR: duplicate column name: color
```

We must modify this migration to use the repository's `safeAddColumns` helper to make it idempotent.

## Current state

- **The broken migration** — `backend/migrations/20260630000003-add-color-to-people.js` (entire file):

```js
'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.addColumn('people', 'color', {
            type: Sequelize.STRING(20),
            allowNull: true,
            defaultValue: null,
        });
    },

    async down(queryInterface) {
        await queryInterface.removeColumn('people', 'color');
    },
};
```

## Commands you will need

| Purpose                     | Command                                                        | Expected on success               |
|-----------------------------|----------------------------------------------------------------|-----------------------------------|
| Reproduce the Docker path   | `cd backend && NODE_ENV=development node scripts/db-init.js && NODE_ENV=development node scripts/db-migrate.js` | **before fix**: fails on `color` duplicate; **after fix**: completes all migrations, exit 0 |
| Migration status            | `npm run migration:status`                                     | `20260630000003` listed as up     |
| Lint (backend)              | `npm run backend:lint`                                         | exit 0                            |
| Backend tests               | `npm run backend:test`                                         | all pass, exit 0                  |

WARNING: Only run the reproduction command against a throwaway **development** database.

## Scope

**In scope** (the only file you should modify):
- `backend/migrations/20260630000003-add-color-to-people.js`

**Out of scope** (do NOT touch):
- `backend/scripts/db-init.js`
- `backend/models/people.js`
- Any other migration file.

## Git workflow

- Branch: `advisor/007-fix-people-color-migration`
- Commit style: Conventional Commits: `fix(migrations): make add-color-to-people idempotent`

## Steps

### Step 1: Rewrite the migration to use the safe helpers

Replace the contents of `backend/migrations/20260630000003-add-color-to-people.js` using the safe helper:

```js
'use strict';

const { safeAddColumns } = require('../utils/migration-utils');

module.exports = {
    async up(queryInterface, Sequelize) {
        await safeAddColumns(queryInterface, 'people', [
            {
                name: 'color',
                definition: {
                    type: Sequelize.STRING(20),
                    allowNull: true,
                    defaultValue: null,
                },
            },
        ]);
    },

    async down(queryInterface) {
        await queryInterface.removeColumn('people', 'color');
    },
};
```

**Verify**: `npm run backend:lint` → exit 0.

### Step 2: Reproduce the fresh-install path and confirm it completes

Against the development database:

```bash
cd backend && NODE_ENV=development node scripts/db-init.js && NODE_ENV=development node scripts/db-migrate.js
```

**Verify**: Exits 0 and all migrations complete successfully.

### Step 3: Confirm idempotency on a second run

Run migrations again:

```bash
cd backend && NODE_ENV=development node scripts/db-migrate.js
```

**Verify**: Exits 0.

### Step 4: Run tests

**Verify**: `npm run backend:test` → exit 0.

## Done criteria

- [ ] `backend/migrations/20260630000003-add-color-to-people.js` uses `safeAddColumns`
- [ ] Fresh init + migrate commands run and exit 0
- [ ] Re-run migrations command exits 0
- [ ] `npm run backend:lint` exits 0
- [ ] `npm run backend:test` exits 0
- [ ] `plans/README.md` updated with Plan 007 row

## STOP conditions

- The migration file does not match the "Current state" excerpt.
- Migration fails on a different file after this fix.
