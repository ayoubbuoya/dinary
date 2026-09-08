# ADR 0001 — Supabase for Google sign-in and cloud backup

- **Status:** Accepted
- **Date:** 2026-09-08
- **Supersedes:** the local-only phase constraint in `AGENTS.md`

## Context

Dinary stored everything in on-device SQLite with no account system. The project
needs authenticated backup and multi-device access, but has no server to host a
backend or database, and no budget for paid infrastructure.

`docs/product-spec.md` (§7.1, §7.2, §7.3) already selected Supabase and a
local-first sync model. This ADR records the decision as implemented and the
choices the spec left open.

## Decision

Use **Supabase** for authentication (Google OAuth) and the cloud Postgres copy.

Supabase supplies Postgres, an auto-generated REST API, and Row Level Security in
one free-tier service, so the app talks to the database directly and no custom
backend has to be written or hosted. The alternative — a separate auth provider
plus a serverless Postgres host such as Neon — offers comparable free storage
(~500 MB either way) but requires building the authorization layer that Supabase
provides out of the box.

### Sign-in is optional

Cloud backup is opt-in and never gates the app. Product spec §2.5 requires the
app to work without an internet connection and treats cloud storage as backup,
never a requirement for day-to-day use. There is therefore no login wall: the
account screen at `/account` is reached from the home-screen avatar, and an
unconfigured or signed-out build behaves exactly like the previous local-only
app.

### Browser-based OAuth, not a native Google SDK

Google sign-in goes through `supabase.auth.signInWithOAuth` with the PKCE flow,
opened via `expo-web-browser` and returned through the existing `dinary://` deep
link scheme.

This needs no new native module, so it works in the current development build
and on web, and its only external configuration is a redirect URL.
`@react-native-google-signin/google-signin` would give a more native Android
sheet via `signInWithIdToken`, at the cost of a new native dependency and SHA-1
certificate setup per build profile. That remains an available upgrade.

### Text primary keys, not UUIDs

The spec's data model specifies UUID primary keys. The shipped local database
instead uses meaningful text ids (`cash`, `bank_card`, `txn_<timestamp>_<rand>`),
and account ids are read directly by UI code (`accountConfigFor(row.id)`).

Rewriting them would mean migrating live financial records and the code that
keys off them. The cloud tables therefore mirror the local text ids, and because
seeded ids such as `cash` are identical for every user, each table is keyed on
`(user_id, id)`. RLS is unaffected — it authorises on `auth.uid() = user_id`.

### Server-authoritative sync cursor

Every cloud table carries both `updated_at` (written by the device) and
`synced_at` (written by a database trigger). Incremental pulls page on
`synced_at` only, so a device with a skewed clock cannot cause rows to be
skipped. `updated_at` is used solely to compare versions.

### Conflicts are preserved, never dropped

Product spec §7.3 forbids silently discarding a conflicting transaction edit.
When a pull finds a row that this device has edited but not yet uploaded, and the
remote copy also moved, the local version is kept and the remote version is
written to a local `sync_conflicts` table. The account screen reports the count.
Automatic last-write-wins applies only where there is no competing local edit.

### One device is claimed by one account

The SQLite file is not partitioned by user. The first sync records
`owner_user_id` in `sync_meta`, and a later sync by a different account fails
with `SyncOwnershipError` instead of uploading the first user's financial
records into the second user's cloud account. The claim deliberately survives
sign-out, and the remedy offered to the user is to sign back in with the
original account — not to reset, which would upload the first user's records
into the second account.

## Consequences

- The app now has an optional network dependency. Every sync failure is
  non-fatal: SQLite stays the operational source of truth and pending changes
  requeue.
- Deletes of recurring rules and budgets became tombstones (`deleted_at`), since
  a hard delete cannot replicate. All read queries filter them out.
- Free-tier Supabase projects pause after ~7 days of inactivity and need a manual
  restore from the dashboard. This affects sync only, not local use.
- The anon key ships in the bundle. This is by design — it grants nothing on its
  own, and RLS is the actual access control. A service-role key must never be
  added to the app.
- Conflict *resolution* UI is not built yet; conflicts are recorded and counted
  but not yet reviewable record-by-record.

## Setup

1. Create a Supabase project (free tier).
2. Run `supabase/migrations/0001_init.sql` in the SQL editor.
3. Enable the Google provider under **Authentication → Providers**, using a
   Google Cloud OAuth client.
4. Add `dinary://auth/callback` to **Authentication → URL Configuration →
   Redirect URLs** (add the web origin too if the web build is used).
5. Copy `.env.example` to `.env` and fill in the project URL and anon key.
