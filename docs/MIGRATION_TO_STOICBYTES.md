# Moving Ledgerly to StoicBytes

How to move the project from the personal accounts to the StoicBytes accounts (Google
`stoicbytes@gmail.com`, GitHub `stoicbytes-studio`) without losing data. Follow the steps in order;
each one says how to check it worked.

The code no longer names a person anywhere. The app greets whoever is signed in by the name in
Settings → Profile, falling back to the part of the sign-in email before the `@`.

## 1. GitHub: a new repository with a clean history

The old repository's history contains the previous name and earlier personal details, so start a
new repository instead of transferring the old one.

1. Signed in as `stoicbytes-studio`, create an **empty, private** repository named `ledgerly`
   (no README, no licence, no `.gitignore`).
2. Install the Claude GitHub App on it (github.com/apps/claude → Configure → choose `ledgerly`),
   then reconnect GitHub in claude.ai so new sessions can see it.
3. Ask Claude to push the code there as one fresh commit authored by "StoicBytes" with a GitHub
   noreply address. Check: the repository shows one commit and no personal name.
4. Settings → Code security → turn on **Private vulnerability reporting** (see `SECURITY.md`).

## 2. Supabase: move the project, keep the data

1. In the current Supabase organisation, invite `stoicbytes@gmail.com` as **Owner** and accept the
   invitation from that inbox.
2. Signed in as StoicBytes, create an organisation (for example "StoicBytes"), then in the old
   organisation open the project → Settings → General → **Transfer project** to it. The database,
   storage, keys and users stay the same.
3. Allow the new sign-in email. In the SQL Editor add `stoicbytes@gmail.com` to the sign-up
   allowlist the same way the current email was added (see `SUPABASE_SETUP.md`, "Sign-up hook").
4. In the app: Settings → Profile → **New sign-in email** → `stoicbytes@gmail.com` → Change email.
   Open the confirmation link sent to the new address (Supabase may also ask the old address to
   confirm). Your data stays because the account is the same; only its email changes. Two-step
   sign-in stays as it is.
5. Set a display name in Settings → Profile (for example "StoicBytes"). That is what the header
   shows.
6. Once you can sign in with the new email, remove the old email from the allowlist.

## 3. Vercel: move and rename the site

1. Create a Vercel team under the StoicBytes account and transfer the project to it (Project →
   Settings → General → Transfer).
2. Rename the project to `ledgerly`, which gives `https://ledgerly.vercel.app` if the name is free
   (otherwise use the address Vercel gives, or a custom domain).
3. Settings → Git → disconnect the old repository and connect `stoicbytes-studio/ledgerly`.
4. Check the environment variables: `EXPO_PUBLIC_SUPABASE_URL`,
   `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `PORTFOLIO_HANDLE` (and `SITE_URL` if used).
5. Redeploy with the build cache turned off.

## 4. Supabase addresses

1. Authentication → URL Configuration: Site URL `https://ledgerly.vercel.app` (or your domain); add
   `https://ledgerly.vercel.app/reset-password` and `/dashboard/settings` (the email-change link
   returns there) to the redirect URLs. Remove the old addresses once the new site works.
2. Edge Functions → Secrets: set `ALLOWED_ORIGINS` if the site is not exactly
   `https://ledgerly.vercel.app`, for example
   `https://your-domain.com,https://ledgerly-*-<team>.vercel.app,http://localhost:8081`.

## 5. Deploying the price function from the new repository

1. Create a Supabase access token while signed in as StoicBytes (Account → Access Tokens).
2. In `stoicbytes-studio/ledgerly` → Settings → Secrets and variables → Actions, add
   `SUPABASE_ACCESS_TOKEN` and `SUPABASE_PROJECT_REF` (the project reference from its URL).
3. Actions → "Deploy Edge Functions" → Run workflow. Check: in the app, Funds → Update prices works.

## 6. Content and clean-up

1. The portfolio's name, photo and links are data, not code: edit them in Dashboard → Portfolio
   and publish again.
2. Revoke the old Supabase and Vercel access tokens, and the old repository's Actions secrets.
3. Make the old repository private, or delete it once the new one is live and checked.
4. Keep an export of the database (Supabase → Database → Backups) before deleting anything old.
