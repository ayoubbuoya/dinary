# Supabase setup guide

Step-by-step setup for Google sign-in and cloud backup, for a project that already
exists in Supabase. See `docs/decisions/0001-supabase-auth-and-cloud-sync.md` for
why these choices were made.

## 1. Run the database migration

1. In the Supabase dashboard, go to **SQL Editor** (left sidebar).
2. Click **New query**.
3. Open `supabase/migrations/0001_init.sql` from the repo, copy its full contents, and paste into the editor.
4. Click **Run** (bottom right, or Ctrl+Enter).
5. You should see "Success. No rows returned." Verify in **Table Editor** — you should see `accounts`, `transactions`, `recurring_rules`, `category_budgets`, each with a shield icon indicating RLS is enabled.

## 2. Get your project URL and anon key

1. Go to **Project Settings** (gear icon, bottom of sidebar) → **Data API** (older guides call this "API").
2. Copy the **Project URL** (`https://<ref>.supabase.co`).
3. Under **Project API keys**, copy the key labeled **`anon` `public`** — this is the one that's safe to ship in the app. **Never copy the `service_role` key into the app.**

## 3. Create a Google OAuth client (Google Cloud Console)

Supabase needs a Google OAuth Client ID/Secret to talk to Google. This happens on Google's side, not Supabase's.

1. Go to [console.cloud.google.com](https://console.cloud.google.com) and select or create a project.
2. Go to **APIs & Services → OAuth consent screen**. Choose **External**, fill in app name (`Dinary`), your support email, and your email under developer contact. Save through the wizard (you can leave it in "Testing" mode with your own Google account added as a test user while developing).
3. Go to **APIs & Services → Credentials → Create Credentials → OAuth client ID**.
4. Application type: **Web application** (correct even though Dinary is mobile — Supabase's OAuth flow is server-mediated, so Google only ever talks to Supabase's web callback).
5. Under **Authorized redirect URIs**, add Supabase's callback URL. In the Supabase dashboard, go to **Authentication → Sign In / Providers → Google** — it shows a **Callback URL (for OAuth)** field, formatted like:
   ```
   https://<your-project-ref>.supabase.co/auth/v1/callback
   ```
   Copy that exact URL into Google Cloud's **Authorized redirect URIs**.
6. Click **Create**. Google shows a **Client ID** and **Client Secret** — copy both.

## 4. Enable Google in Supabase

1. In Supabase: **Authentication → Sign In / Providers → Google**.
2. Toggle it **on**.
3. Paste the **Client ID** and **Client Secret** from step 3.
4. Save.

## 5. Configure redirect URLs in Supabase

This lets Supabase hand control back to the Dinary app after Google sign-in.

1. Go to **Authentication → URL Configuration**.
2. Under **Redirect URLs**, add:
   ```
   dinary://auth/callback
   ```
   This matches the deep link scheme (`"scheme": "dinary"`) already set in `app.json`.
3. If also testing on web (`expo start --web`), add `http://localhost:8081` (or whatever port Expo web uses).
4. Save.

## 6. Add your local `.env`

Copy `.env.example` to `.env` in the project root (already gitignored) and fill in the two values from step 2:

```
EXPO_PUBLIC_SUPABASE_URL=https://<your-project-ref>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<your-anon-public-key>
```

## 7. Rebuild and test

A new native config plugin (`expo-secure-store`) was added, so a plain `expo start` against an existing dev build won't pick it up — a fresh native build is required:

```
npx expo prebuild --clean
npx expo run:android   # or run:ios
```

Then in the app: open the home screen → tap the avatar (top right) → **Continue with Google**. It should open a browser tab, let you pick a Google account, then return to the app signed in.

## Verifying sync works

1. Sign in, then add a transaction.
2. In Supabase **Table Editor → transactions**, confirm the row appears (may take a few seconds; pull-to-refresh or reopen `/account` to trigger a sync).
3. Edit the transaction's `note` directly in the Table Editor, then reopen the app (or background/foreground it) — the change should pull down locally.
4. Check `/account` in the app: it should show "All changes are backed up" with a recent "Last synced" time and no conflict warning.
