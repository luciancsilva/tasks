# Instance Branding

[← Back to Index](../CLAUDE.md)

---

Branding lets an instance admin replace the stock tududi identity — application
name, light/dark logos and favicon — for **every user of the instance**. It is
not a per-user preference.

## Data Model

Branding lives in the global key/value `settings` table
(`backend/models/setting.js`), not on the user record, for two reasons: it is
shared by the whole instance, and it must be readable **before login** so the
Login and Register pages can render it.

| Setting key | Holds |
|---|---|
| `branding_app_name` | The custom application name (max 100 chars). |
| `branding_logo_light` | Public URL of the light-theme logo. |
| `branding_logo_dark` | Public URL of the dark-theme logo. |
| `branding_favicon` | Public URL of the favicon. |

Asset settings store the **public URL** (`/api/branding/asset/<filename>`), not
the R2 key. The corresponding object key is `branding/<filename>` — see
[Object Storage](15-storage.md) for the key layout. Clearing a value deletes the
settings row rather than storing an empty string, so "unset" has exactly one
representation.

## Endpoints

Defined in `backend/modules/branding/routes.js`, which exports two routers:
`publicRoutes` (no auth) and `adminRoutes` (behind the global `requireAuth` in
`app.js`, plus an explicit admin check per handler).

| Method | Route | Access | Purpose |
|---|---|---|---|
| GET | `/api/branding` | Public | Current branding; every field `null` when not customized. |
| GET | `/api/branding/asset/:filename` | Public | Streams a logo/favicon from R2. |
| PUT | `/api/branding` | Admin | Set or clear the application name. |
| POST | `/api/branding/asset/:kind` | Admin | Upload an asset, replacing any previous one. |
| DELETE | `/api/branding/asset/:kind` | Admin | Remove an asset and fall back to the default. |

`:kind` is one of `logo_light`, `logo_dark`, `favicon`; anything else is a 400.
Uploads accept image types only (jpeg/png/gif/webp/svg/ico), capped at 2 MB.

The public asset route is deliberately public — the Login page needs the logo
before a session exists. It hardens the response instead of authenticating it:
the filename must be a single path segment (no separators, no traversal), and it
sets `X-Content-Type-Options: nosniff` plus a restrictive
`Content-Security-Policy`, so a hostile SVG uploaded by an admin cannot execute
scripts.

## Fallback

Every branding field is nullable and null means "use the stock tududi asset";
there is no separate "enabled" flag. `frontend/contexts/BrandingContext.tsx`
resolves the fallbacks:

- `appName` falls back to `DEFAULT_APP_NAME` (`'tududi'`).
- `getLogoSrc(isDarkMode)` falls back to the bundled `wide-logo-*.png`.
- `applyFavicon` swaps every `<link rel="icon">` to the custom favicon, stashing
  the original in `data-defaultHref` so clearing restores the default without a
  reload.

## Asset Lifecycle

Uploading a new asset or clearing one deletes the previous R2 object
(`setAsset` / `clearAsset` in `backend/modules/branding/service.js`). Deletion is
best-effort and never fails the request. If an upload is rejected *after*
multer-s3 already streamed the file to the bucket (for example, the admin check
fails), the handler removes the just-uploaded object so the rejection does not
leak an orphan.

## Admin UI

`frontend/components/Profile/tabs/BrandingTab.tsx` — a tab in Profile Settings,
visible to admins. It calls `refreshBranding()` after each mutation so the change
propagates without a reload.

## i18n

Strings live under the `profile.branding.*` keys, translated across the 25
locales in `public/locales/`. The **custom app name itself is not translated** —
it is instance data, stored once and rendered as-is in every language.

## Known Limitation: PWA Manifest

`public/manifest.json` is a static file: `name`, `short_name` and `icons` are
baked in at build time and are **not** affected by custom branding. An installed
PWA therefore still shows "tududi" and the stock icons. Making the manifest
dynamic would require serving it from a route that reads the settings table.

---

[← Back to Index](../CLAUDE.md)
