# Project Studio — public pilot

An independently branded public app for learning and creative teams. The original CourseStudio app and its workspace data remain separate.

## Experiences

- Public landing page with a fictional interactive demo. Demo changes live only in page memory, never a production database. Reset demo starts fresh.
- Verified existing accounts can create up to five private workspaces, switch teams, and use projects, task assignments, named workflows, reviews, comments, links, and group roles.
- Membership is specific to each workspace. A workspace administrator cannot access another workspace just by knowing its ID. Registration never grants membership in existing teams.
- Adding a person by email grants membership once that same verified email signs in. It does not send an invitation email.

## Public registration is intentionally closed for this pilot

`lib/release-config.ts` leaves new public account registration closed while Supabase is using its limited built-in email sender. Configure and test a dedicated sender (for example Resend), add the full public app URL to Supabase Auth’s redirect allowlist, then set `publicSignupsOpen=true` and deploy. Email verification must stay enabled. Existing verified accounts can still sign in. Do not publish keys or SMTP passwords in this source.

Deployment address: `https://drshanshanma.github.io/eduflow.github.io/public/`.

## Backend

The `public-workflow` Edge Function uses Supabase Auth and the pre-existing server-only `coursestudio_session_active` check. It owns all workspace queries. Apply `supabase/security/private-workspaces.sql` once before deploying it. Tables and RPCs revoke access from browser roles; only the server role may use them. The service key stays in the function environment.

Workspace state and the email membership index update together in `project_studio_save`. Version checks prevent overwriting another user’s changes. The function verifies active session identity and membership before loading payloads. Creation is limited to five workspaces per creator under a transaction lock.

This app uses a separate Auth storage key from CourseStudio. Confirmation and recovery credentials are removed from the address bar before processing. Copy app link copies only the clean URL.

## Development

Use Node 24 and the packageManager version in package.json. Install dependencies with `pnpm install --frozen-lockfile`, run `pnpm dev`, `pnpm test`, and `pnpm build`. The build checks that server credentials have not entered static assets. Public Supabase connection settings are in `lib/deployment-config.json`; environment variables can override them.

Production publication builds this source under the repository’s `public-studio/` folder and places its static output under `/public/`. It preserves the original app at the repository root.
