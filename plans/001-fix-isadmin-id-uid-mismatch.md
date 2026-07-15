# Plan 001: `isAdmin()` recognizes both numeric user IDs and UIDs

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat a55e4ad..HEAD -- backend/services/rolesService.js backend/services/permissionsService.js backend/modules/shares/service.js backend/services/execAction.js`
> If any of these files changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `a55e4ad`, 2026-07-11

## Why this matters

`isAdmin()` resolves a user by `uid` (a non-numeric string), but several
security-relevant call sites pass a **numeric** user id instead. Those lookups
never match, so `isAdmin()` silently returns `false` and admin users are denied
capabilities the code intends to grant: managing shares they don't own,
computing resource access in `permissionsService.getAccess`, and the
`execAction` share-authorization guard. The failure direction is "deny" (not a
privilege escalation), so it is safe today — but it is an invisible functional
bug, and any future caller that relies on `isAdmin` for a **grant** decision
would inherit a latent footgun. There is already a hand-rolled workaround for
this exact mismatch in one file (`permissionsService.js:106-117`), confirming
the inconsistency is real and known. This plan fixes it once, at the source.

## Current state

- `backend/services/rolesService.js` — the whole file. `isAdmin` looks a user
  up by `uid` only:

```js
// backend/services/rolesService.js:1-18
const { Role, User } = require('../models');

async function isAdmin(userUid) {
    if (!userUid) return false;

    // Find user by uid to get numeric id for role lookup
    const user = await User.findOne({
        where: { uid: userUid },
        attributes: ['id'],
    });

    if (!user) return false;

    const role = await Role.findOne({ where: { user_id: user.id } });
    return !!(role && role.is_admin);
}

module.exports = { isAdmin };
```

- `backend/utils/request-utils.js` — the id the broken callers pass is
  **numeric** (`req.currentUser.id` / `req.session.userId` are DB integer ids):

```js
// backend/utils/request-utils.js:1-2
const getAuthenticatedUserId = (req) =>
    req.currentUser?.id || req.session?.userId;
```

- **Callers that pass a numeric id (currently BROKEN — this plan fixes them):**
  - `backend/services/permissionsService.js:18` — `if (await isAdmin(userId)) return ACCESS.ADMIN;` (`userId` is numeric here)
  - `backend/modules/shares/service.js:35` — `const userIsAdmin = await isAdmin(userId);`
  - `backend/modules/shares/service.js:87` — same
  - `backend/modules/shares/service.js:125` — same
  - `backend/services/execAction.js:13` — `if (await isAdmin(actorUserId)) return;`

- **Callers that already pass a `uid` string (must KEEP working):**
  - `backend/modules/admin/service.js:38,61`
  - `backend/modules/auth/service.js:140,216`
  - `backend/services/permissionsService.js:119` (passes `userUid` after converting a numeric id — see the existing workaround at lines 106-117)

- **Existing workaround to be aware of** (do NOT remove it in this plan — it is
  out of scope and harmless once `isAdmin` is robust):

```js
// backend/services/permissionsService.js:106-119
    // Note: isAdmin expects a UID, but we might receive a numeric ID
    // Get the user's UID if we received a numeric ID
    let userUid = userId;
    if (typeof userId === 'number' || !isNaN(parseInt(userId))) {
        const { User } = require('../models');
        const user = await User.findByPk(userId, {
            attributes: ['uid', 'email'],
        });
        if (user) {
            userUid = user.uid;
        }
    }
    const isUserAdmin = await isAdmin(userUid);
```

- Repo conventions: backend is plain CommonJS Node (`require`/`module.exports`),
  async/await, Sequelize models imported from `../models`. Unit tests live in
  `backend/tests/unit/` and use Jest. The existing test for this function is
  `backend/tests/unit/services/rolesService.test.js` — match its structure.

## Commands you will need

| Purpose        | Command                                                        | Expected on success |
|----------------|---------------------------------------------------------------|---------------------|
| Backend tests  | `npm run backend:test`                                        | all pass, exit 0    |
| This test only | `cd backend && cross-env NODE_ENV=test jest tests/unit/services/rolesService.test.js` | all pass |
| Lint (backend) | `npm run backend:lint`                                        | exit 0              |

## Scope

**In scope** (the only files you should modify):
- `backend/services/rolesService.js`
- `backend/tests/unit/services/rolesService.test.js`

**Out of scope** (do NOT touch, even though they look related):
- `backend/services/permissionsService.js` — the workaround at lines 106-117
  stays; it becomes redundant but removing it is a separate cleanup and risks
  regressions. Leave it exactly as-is.
- `backend/modules/shares/service.js`, `backend/services/execAction.js` — do NOT
  change the call sites. The fix is entirely inside `isAdmin`, so callers keep
  passing whatever they pass today.
- Any change to how `uid` is generated or to the `User`/`Role` models.

## Git workflow

- Branch: `advisor/001-fix-isadmin-id-uid-mismatch`
- Commit style: Conventional Commits (repo uses e.g. `fix(tasks): ...`,
  `fix(kanban/eisenhower): ...`). Suggested message:
  `fix(auth): make isAdmin resolve users by numeric id or uid`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Make `isAdmin` accept a numeric id or a uid

Replace the body of `isAdmin` in `backend/services/rolesService.js` so it
resolves the user whether it is given a numeric id (number) or a uid (string).
Try `uid` first for string input to preserve exact current behavior, then fall
back to a numeric-id lookup only when the string is all digits. Produce this
shape:

```js
const { Role, User } = require('../models');

async function isAdmin(userIdOrUid) {
    if (userIdOrUid === null || userIdOrUid === undefined || userIdOrUid === '') {
        return false;
    }

    let user = null;
    if (typeof userIdOrUid === 'number') {
        // Numeric primary key (the value returned by getAuthenticatedUserId).
        user = await User.findByPk(userIdOrUid, { attributes: ['id'] });
    } else {
        // String: try uid first (the historical contract), then fall back to a
        // numeric-id lookup for callers that pass a numeric id as a string.
        user = await User.findOne({
            where: { uid: userIdOrUid },
            attributes: ['id'],
        });
        if (!user && /^\d+$/.test(userIdOrUid)) {
            user = await User.findByPk(Number(userIdOrUid), {
                attributes: ['id'],
            });
        }
    }

    if (!user) return false;

    const role = await Role.findOne({ where: { user_id: user.id } });
    return !!(role && role.is_admin);
}

module.exports = { isAdmin };
```

**Verify**: `npm run backend:lint` → exit 0, no errors on `rolesService.js`.

### Step 2: Extend the unit tests to cover numeric-id input

Open `backend/tests/unit/services/rolesService.test.js`. It currently covers
null/undefined/empty/nonexistent-uid, and `uid`-based admin/non-admin cases
(passing `user.uid`). Keep all existing tests unchanged. Add cases that pass the
**numeric** `user.id`:

- `isAdmin(user.id)` returns `true` when that user has an admin role. Model this
  on the existing "returns true for admin user" test, but pass `user.id` instead
  of `user.uid`.
- `isAdmin(user.id)` returns `false` when that user is not an admin. Model on the
  existing non-admin test, passing `user.id`.
- `isAdmin(999999)` (a numeric id with no matching user) returns `false`.

Use the same setup/fixtures (`User.create` / `Role.create`) the existing tests
use — do not invent a new harness. Match the file's Arrange-Act-Assert style.

**Verify**: `cd backend && cross-env NODE_ENV=test jest tests/unit/services/rolesService.test.js`
→ all tests pass, including the new numeric-id cases.

### Step 3: Full backend suite stays green

**Verify**: `npm run backend:test` → exit 0, all pass. In particular any tests
under `backend/tests/integration/shares*` and `project-sharing*` must still pass
(they exercise the share paths that call `isAdmin`).

## Test plan

- New tests in `backend/tests/unit/services/rolesService.test.js`:
  - happy path: `isAdmin(numericId)` → `true` for an admin user (the specific
    regression this plan fixes)
  - `isAdmin(numericId)` → `false` for a non-admin user
  - `isAdmin(999999)` → `false` for an unknown numeric id
  - all pre-existing uid-based cases still pass (regression guard for the string
    path)
- Structural pattern: the existing `backend/tests/unit/services/rolesService.test.js`.
- Verification: `npm run backend:test` → all pass, including the 3 new cases.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `npm run backend:test` exits 0; new numeric-id tests in
      `rolesService.test.js` exist and pass
- [ ] `npm run backend:lint` exits 0
- [ ] Only `backend/services/rolesService.js` and
      `backend/tests/unit/services/rolesService.test.js` are modified
      (`git status` shows no other files)
- [ ] `plans/README.md` status row for 001 updated

## STOP conditions

Stop and report back (do not improvise) if:

- The code in `backend/services/rolesService.js` does not match the "Current
  state" excerpt (the file has drifted since this plan was written).
- Any existing share/permission integration test fails after the change — this
  would mean some path depended on the old deny behavior; report which test and
  do not paper over it.
- You discover `uid` values in this codebase can legitimately be all-digit
  strings that collide with real numeric ids (they are 21-char nanoid strings;
  if the model init shows otherwise, stop and report).

## Maintenance notes

- After this lands, the workaround in `permissionsService.js:106-117` is
  redundant. A future cleanup plan can delete it and pass the raw id straight to
  `isAdmin`. Not done here to keep this change minimal and low-risk.
- Edge case documented for reviewers: the string path tries `uid` first, then a
  numeric-id fallback only for all-digit strings. Since uids are 21-char nanoid
  strings, an all-digit uid collision is astronomically unlikely; if uid
  generation ever changes to short numeric codes, revisit this branch.
- Reviewer should scrutinize: that no call site was changed (the fix is purely
  inside `isAdmin`), and that the uid-string path still short-circuits before the
  numeric fallback.
