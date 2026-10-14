# Phone apps (Android and iPhone)

The same code as the web app, built as native apps with Expo Application Services (EAS).
Nothing here needs a Mac: builds run on Expo's servers. Until you build them, use the web app
on your phone (it can be added to the home screen).

## What you need (once)

- **An Expo account** (free) at expo.dev. Builds on the free plan queue for a while.
- **Android:** nothing else for the preview build (an `.apk` you install directly). The Play
  Store needs a Google Play developer account (one-time fee).
- **iPhone:** an Apple Developer account (yearly fee), even to install on your own phone.

## Set up the project (once, on your computer)

Run these from `apps/command-center`. You sign in yourself: never share your Expo or Apple
password, and none of it is stored in this repository.

```sh
npx eas-cli@24.8.0 login          # your Expo account
npx eas-cli@24.8.0 init           # creates the Expo project and prints its project ID
```

Then, in the Expo project (expo.dev → your project):

1. **Environment variables** (Project settings → Environment variables), for the `preview` and
   `production` environments:
   - `EXPO_PUBLIC_SUPABASE_URL`: your Supabase project URL;
   - `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: the **publishable** key, never the secret or
     service-role key;
   - `EAS_PROJECT_ID`: the project ID from `eas init`;
   - `EXPO_OWNER`: your Expo account or organization name.
2. **Supabase redirect URLs** (Authentication → URL Configuration): add
   `ledgerly://reset-password` and `ledgerly://dashboard/settings`, so password-reset and
   email-change links open the app. The app reads the one-time code from the link
   (`features/auth/useAuthLinks.ts`); like on the web, it only works on the device that asked
   for the link.

## Build

- **From your computer:** `npx eas-cli@24.8.0 build --platform android --profile preview`.
  The first iPhone build must be run this way (`--platform ios`): EAS asks you to sign in to
  Apple and creates the certificates, then keeps them for later builds.
- **From GitHub:** add the repository secret `EXPO_TOKEN` (expo.dev → Account settings →
  Access tokens; a token for this purpose only), then Actions → **Phone app build** → Run
  workflow, choosing the platform and profile. The workflow only starts the build; Expo emails
  you the download link. Without the secret it does nothing.

Profiles (`eas.json`): **preview** is for installing directly (Android `.apk`, iPhone ad hoc
for registered devices); **production** is for the stores (Android app bundle, build numbers
counted up by EAS).

## How the phone app differs from the web app

- Sign-in stays in the phone's keychain/keystore (`expo-secure-store`), so "Keep me signed in"
  is always on; two-step sign-in and idle sign-out still apply.
- Tokens refresh only while the app is open.
- Spreadsheet import, restore from backup, CSV and PDF downloads use the web file picker and
  download, so they are web-only for now; the cards say so on the phone.

## Not tested from this repository

No native build has been run yet (it needs your Expo account). Check sign-in, the two-step
code, a password reset link and adding an entry on a real phone after the first build.
