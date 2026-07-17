# Object Storage (Cloudflare R2)

Tududi supports Cloudflare R2 (or any S3-compatible object storage) as an alternative to the local filesystem for storing file attachments, user avatars, project covers, and branding assets.

## Configuration

Storage configuration is resolved via environment variables. The canonical variable names are prefixed with `CLOUDFLARE_`, with legacy `R2_` names supported as fallbacks.

- `CLOUDFLARE_R2_ACCESS_KEY_ID`: S3 Access Key ID
- `CLOUDFLARE_R2_SECRET_ACCESS_KEY`: S3 Secret Access Key
- `CLOUDFLARE_R2_BUCKET`: Name of the bucket (defaults to `tududi-test` in the test environment)
- `CLOUDFLARE_ACCOUNT_ID` / `CLOUDFLARE_R2_ENDPOINT`: Account ID (used to construct the endpoint) or explicit custom S3 endpoint override.
- `CLOUDFLARE_R2_REGION`: S3 region (defaults to `auto` per Cloudflare guidelines)

If these variables are missing, the application automatically falls back to using the local filesystem under the `uploads/` directory.

## Object Layout (Key Prefix)

Objects in the bucket are prefixed by their domain to organize files logically:

| Feature / Prefix | Key Pattern | Description |
|---|---|---|
| Tasks / attachments | `tasks/task-<timestamp>-<rand>.<ext>` | Uploaded file attachments linked to tasks. |
| Users / avatars | `avatars/avatar-<userId>-<timestamp>.<ext>` | Profile avatar image. |
| Projects / covers | `projects/cover-<projectId>-<timestamp>.<ext>` | Project cover banners. |
| System / branding | `branding/<kind>-<timestamp>-<rand>.<ext>` where `<kind>` is `logo_light`, `logo_dark` or `favicon` | Custom instance branding assets. |

## Delivery (Proxying)

All uploaded assets (except custom branding logos/favicon) are served through the authenticated Express proxy route to ensure permissions are verified:

- Route: `/api/uploads/:prefix/:filename`
- Logic: Validates if the requesting user has permission to view the parent entity (e.g. task or project) before fetching the stream from R2 and piping it to the response.
- Branding assets are public and served at `/api/branding/asset/:filename`, because the Login and Register pages need them before a session exists. See [Branding](16-branding.md).

## Orphan Cleanup & Lifecycle Rules

### Automated Deletion (Best-Effort)

To prevent storage bloat, the application performs best-effort cleanup on entity deletion:
- **Task Delete**: Deleting a task automatically triggers R2 object deletion for all task attachments, subtask attachments, and recurring instance attachments.
- **Project Delete / Cover Update**: Deleting a project or updating its cover banner deletes the previous cover image from R2.
- **Avatar Update**: Changing user avatars deletes the old avatar from the bucket.
- **Branding Asset Replace / Clear**: Uploading a new logo or favicon, or clearing one, deletes the previous object.

Deletion is **best-effort**: `deleteObject` failures are logged but never fail the
request, so a bucket outage cannot block a task deletion. The trade-off is that a
failed delete leaves an orphan object, which is what the reconciliation below is
for. Object deletion is deferred until after the database transaction commits, so
a rolled-back delete does not destroy files that are still referenced.

### R2 Bucket Lifecycle Rules

Sometimes uploads fail mid-stream or a server crash happens between the file upload completion and the database transaction commit. This results in "orphan" objects that reside in the bucket but have no corresponding database record.

To clean these up automatically:
1. Go to your Cloudflare dashboard → **R2** → Select your bucket → **Settings** → **Lifecycle Rules**.
2. Click **Add rule** to automatically clean up incomplete multipart uploads:
   - **Name**: `Abort incomplete multipart uploads`
   - **Action**: Delete incomplete multipart uploads after `7` days (or any threshold of choice).

### Manual Reconciliation (Reclaim Space)

For full reconciliation, you can execute a script or manual database query comparison to list and delete orphan files.

1. **Get active files from database**:
   - For attachments: `SELECT file_path FROM task_attachments;`
   - For avatars: `SELECT avatar FROM users WHERE avatar IS NOT NULL;` (remove the URL prefix to get the key)
   - For project covers: `SELECT cover_image FROM projects WHERE cover_image IS NOT NULL;`

2. **List all objects in R2**:
   Use `aws-cli` or wrangler to list keys, then diff them against the database paths.

3. **Delete orphans**:
   Delete any key present in the R2 list but not in the database.
