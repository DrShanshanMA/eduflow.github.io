# CourseStudio — GitHub Pages + Supabase

An independent version of CourseStudio. This source does not modify or synchronize with the existing ChatGPT Sites app. It starts with a separate empty workspace.

## Hosting setup

1. Use the `DrShanshanMA/eduflow.github.io` repository for this source. Its normal project Pages address is `https://drshanshanma.github.io/eduflow.github.io/` (the repository name alone does not create an eduflow.github.io domain).
2. In Supabase, apply `supabase/migrations/202611170001_workspace.sql`. It creates an isolated server-only workspace table; browsers have no table access.
3. Configure the server-only `coursestudio_settings` row (id `team`, `owner_email`, and JSON `allowed_origins`), or set Edge Function secrets `COURSESTUDIO_OWNER_EMAIL` to the initial administrator's verified sign-in email and `COURSESTUDIO_ALLOWED_ORIGINS` to `https://drshanshanma.github.io`. Add additional origins separated by commas only when needed. Secrets belong in Supabase, never GitHub Pages.
4. Deploy `supabase/functions/workflow` as `workflow` with gateway JWT verification disabled. The function verifies every bearer token directly with Supabase Auth before authorizing access. The platform supplies its server credentials.
5. Enable email/password authentication and email confirmation in Supabase Auth. Set Site URL and allowed redirect URL to the full Pages address above. Configure production email delivery before inviting a team.
6. Public connection settings for the selected project are recorded in `lib/deployment-config.json` (publishable key only). To override them, add GitHub repository Actions variables `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` from the project's public connection settings. Never put a secret/service-role key there.
7. In repository Settings → Pages, select GitHub Actions. Run the Publish CourseStudio workflow after the backend is configured.
8. Create and confirm the owner account. Sign in once to initialize the new workspace, then add team members by their verified sign-in emails. Team members create their own accounts; authentication registration alone does not grant project access.

GitHub Pages publishes only `dist/`; the Supabase function and database enforce roles and private project visibility. Concurrent edits use version checks rather than silently overwriting each other. Notifications currently appear inside the app; this package does not send email notifications.

## Updating

Frontend changes deployed from main update the GitHub Pages version. Backend changes require Supabase function/migration deployment. The original Sites app remains separate. Export/back up data before database changes; migration of existing Sites data is not automatic. An administrator-only authenticated GET `functions/v1/workflow?operation=export` provides the new workspace backup.

## Local development and verification

Use Node 24 and pnpm (the packageManager version is recorded in package.json). Run `pnpm install --frozen-lockfile`, copy `.env.example` to `.env.local`, and use only public Supabase connection values. Then run `pnpm dev`. Allow `http://127.0.0.1:5173` in the Edge Function origins and Auth redirect URLs for local testing.

Run `pnpm test` for domain/access/backend tests and `pnpm build` for type checking, the production build, and a public credential scan. `pnpm package:source` creates a source-only zip alongside this folder.

This version preserves the four project categories, courses, custom workflow steps/templates, task organizers and assignments, task counts, comments/links, private groups, review/correction loops, and member removal/restoration. Production sign-in and email delivery must be tested against the selected Supabase project before team use.
