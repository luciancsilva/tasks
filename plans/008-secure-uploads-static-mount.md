# Plan 008: Require authentication on the `/api/uploads` static file mount

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat f071873..HEAD -- backend/app.js backend/tests/integration/uploads-auth.test.js`
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

Every uploaded file — task attachments, user avatars, project images — is served
by an `express.static` mount registered **before** the authentication middleware
in `backend/app.js`. Any unauthenticated party who knows or guesses a URL like
`/api/uploads/tasks/task-1720000000000-123456789.pdf` can download any user's
file. Filenames are `Date.now()` plus a random 9-digit number (see
`backend/modules/tasks/attachments.js:43-46`), which is not a security boundary.
This plan puts the mount behind the same `requireAuth` middleware every API
route already uses. After it lands, unauthenticated requests to
`/api/uploads/...` receive 401 instead of file contents.

## Current state

- `backend/app.js` — Express app assembly. The uploads static mount is
  registered at lines 212-220, **before** `requireAuth` is even imported at
  line 223:

  ```js
  // backend/app.js:212-223
  // Serve uploaded files
  const registerUploadsStatic = (basePath) => {
      app.use(`${basePath}/uploads`, express.static(config.uploadPath));
  };

  registerUploadsStatic('/api');
  if (API_VERSION && API_BASE_PATH !== '/api') {
      registerUploadsStatic(API_BASE_PATH);
  }

  // Authentication middleware
  const { requireAuth } = require('./middleware/auth');
  ```

- `backend/middleware/auth.js` — `requireAuth` (lines 29-114). Accepts three
  credentials: session cookie (`req.session.userId`), `tt_`-prefixed API
  tokens, and (when OIDC is enabled) OAuth2 JWTs. On failure it responds
  `401 {"error": "..."}`. It skips only `/api/health`, `/api/login`,
  `/api/current_user` (line 32) — note the skip check uses `req.path`, which
  inside a mounted router is relative to the mount point, but none of the
  skip paths can collide with a filename under `/api/uploads` in a way that
  matters (a file literally named `health` at the uploads root would be
  served without auth; acceptable).

- `backend/config/config.js:103-104` — `uploadPath` defaults to
  `<projectRoot>/uploads`, overridable via `TUDUDI_UPLOAD_PATH`.

- Consumers of these URLs (all authenticated, so they keep working):
  - Browser `<img>` previews: `frontend/components/Shared/AttachmentCard.tsx:48-50`
    and `frontend/components/Shared/AttachmentPreview.tsx:21` use
    `attachment.file_url`, which the backend builds as
    `/api/uploads/tasks/<stored_filename>` (`backend/utils/attachment-utils.js:129-131`).
    Same-origin `<img>` requests send the session cookie, so they pass
    `requireAuth` unchanged.
  - Explicit downloads already use a separate authorized route
    (`backend/modules/tasks/attachments.js:265-307`, `GET
    /attachments/:attachmentUid/download`) which performs a per-attachment
    permission check. Do not touch it.
  - Avatars are stored under `uploads/avatars` (`backend/modules/users/routes.js:19`)
    and project images under `uploads/projects` (`backend/modules/projects/routes.js:17`);
    both are only displayed inside the authenticated app.

- Repo conventions: modules are mounted with `requireAuth` as inline
  middleware — see the Swagger mount at `backend/app.js:276`:
  `app.use('/api-docs', requireAuth, swaggerUi.serve);`. Match that pattern.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Backend tests (all) | `npm run backend:test` | exit 0, all pass |
| Backend tests (one file) | `cd backend && npx cross-env NODE_ENV=test npx jest tests/integration/uploads-auth.test.js` | all pass |
| Lint | `npm run backend:lint` | exit 0 |

## Scope

**In scope** (the only files you should modify):
- `backend/app.js`
- `backend/tests/integration/uploads-auth.test.js` (create)

**Out of scope** (do NOT touch, even though they look related):
- `backend/modules/tasks/attachments.js` — the authorized download route is
  correct as-is.
- Per-file ownership checks on the static mount (i.e., preventing user A from
  fetching user B's file while *authenticated*). That is a real follow-up but
  needs a lookup route replacing `express.static`; deliberately deferred —
  see Maintenance notes.
- `frontend/**` — no frontend change is needed; cookie-authenticated `<img>`
  requests keep working.
- `backend/middleware/auth.js` — do not add skip paths or change semantics.

## Git workflow

- Branch: `advisor/008-secure-uploads-static-mount`
- Commit style: conventional commits, e.g. `fix(security): require auth for /api/uploads static files`
  (matches history: `fix(auth): make isAdmin resolve users by numeric id or uid`)
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Move the `requireAuth` import above the uploads mount and apply it

In `backend/app.js`, change the `registerUploadsStatic` block (lines 212-220)
so the mount includes `requireAuth`, importing it just before. Target shape:

```js
// Serve uploaded files (authenticated — files must never be public)
const { requireAuth } = require('./middleware/auth');
const registerUploadsStatic = (basePath) => {
    app.use(`${basePath}/uploads`, requireAuth, express.static(config.uploadPath));
};

registerUploadsStatic('/api');
if (API_VERSION && API_BASE_PATH !== '/api') {
    registerUploadsStatic(API_BASE_PATH);
}
```

Then remove the now-duplicate `const { requireAuth } = require('./middleware/auth');`
from line 223 (keep the `logError` import that sits next to it).

**Verify**: `npm run backend:lint` → exit 0 (catches accidental duplicate
declaration of `requireAuth`).

### Step 2: Write the integration test

Create `backend/tests/integration/uploads-auth.test.js`. Model the setup on
`backend/tests/integration/task-attachments.test.js` (it already writes real
files into the uploads directory around line 352 and authenticates with
`supertest-session`). Cover:

1. Unauthenticated `GET /api/uploads/tasks/<file>` → **401** with JSON error
   body (previously 200).
2. Session-authenticated `GET /api/uploads/tasks/<file>` → **200** with file
   contents.
3. Unauthenticated `GET /api/uploads/does-not-exist.txt` → **401** (auth is
   checked before existence — no 404 oracle for probing filenames).

Create the fixture file under the uploads dir in `beforeAll` and remove it in
`afterAll`, exactly as `task-attachments.test.js` does.

**Verify**: `cd backend && npx cross-env NODE_ENV=test npx jest tests/integration/uploads-auth.test.js` → 3 tests pass.

### Step 3: Run the full backend suite

**Verify**: `npm run backend:test` → exit 0. Pay attention to
`tests/integration/task-attachments.test.js` and
`tests/integration/project-sharing.test.js` — they exercise attachment flows
and must still pass (they authenticate, so they should).

## Test plan

Covered by Step 2. Pattern file: `backend/tests/integration/task-attachments.test.js`.
Three new tests as listed. No existing test asserts that uploads are publicly
readable (verified during planning), so no test should need deletion — if one
fails asserting a 200 on an unauthenticated fetch, that test embodied the bug;
STOP and report rather than deleting it.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `npm run backend:test` exits 0; the 3 new tests in
      `tests/integration/uploads-auth.test.js` exist and pass
- [ ] `npm run backend:lint` exits 0
- [ ] `grep -n "uploads" backend/app.js` shows `requireAuth` inside the
      `registerUploadsStatic` mount line
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- `backend/app.js:212-223` does not match the excerpt above (drift).
- Any existing test fails because it fetches `/api/uploads/...` without
  authentication — that means some flow depends on public files (e.g. a
  login-page asset); report which test, do not weaken `requireAuth`.
- You find any *other* static mount serving `config.uploadPath` (search:
  `grep -rn "uploadPath" backend/app.js`) beyond the two `registerUploadsStatic`
  calls — report it instead of patching more mounts ad hoc.

## Maintenance notes

- **Deferred follow-up**: authenticated users can still fetch other tenants'
  files by URL. Full fix = replace `express.static` with a route that resolves
  the file to its owning record (task attachment / avatar / project image) and
  applies `permissionsService.getAccess`, like
  `backend/modules/tasks/attachments.js:265-307` does. Avatars may
  legitimately be visible to project-share collaborators — needs a product
  decision.
- Reviewers should confirm the mount order: session middleware (app.js:171)
  must still run before the uploads mount, or cookie auth breaks. The change
  keeps the mount in the same position, only adding middleware, so order is
  preserved.
- If a public landing page ever needs an asset from uploads, serve it from
  `public/` instead of weakening this mount.
