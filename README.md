# ASTERIAL — Version 1.1

**Official Developer:** Ritam Das · **By X Huracan**

ASTERIAL is an original, dark-first monochrome real-time messaging platform engineered with Next.js (App Router), React 19, strict TypeScript, Tailwind CSS v4, and Supabase (Auth, PostgreSQL 17, Realtime, Private Storage, and mandatory Row Level Security).

---

## Core Capabilities (Version 1.1)

- **Authentication & Identity**: Email/password registration with live `@username` availability checking, login, session persistence, password recovery, first-run profile onboarding, private avatar uploads, and confirmed self-service account deletion with cascade cleanup and group ownership handoff.
- **1-to-1 Direct Messaging**: Canonical pair-key constraint preventing duplicate DM threads, instant Realtime message delivery, cursor-paginated message history, replies, sender message editing (`edited_at`), soft-deletion (`deleted_at` content wipe), emoji picker, message reactions, copy text, optimistic send states with retry/discard recovery, and automatic offline/reconnect catch-up.
- **Verified Delivery & Read Receipts**: Database-backed `message_receipts` (`delivered_at`, `read_at`) synchronized via Realtime Postgres changes and governed by each user's `read_receipts_enabled` privacy preference.
- **Multi-Member Groups**: Group creation with optional group avatar and description, `owner` / `admin` / `member` role hierarchy enforced in PostgreSQL RLS & constrained RPC workflows, member invitations/removals, role promotions, leave-group ownership transfer, and system event timeline entries.
- **Conversation Organization**: Sidebar filters (`All`, `Unread`, `Direct`, `Groups`, `Archived`), per-member pin/unpin, mute/unmute, archive/restore, unread counters, global workspace search (`⌘K` / `Ctrl+K`), and in-conversation message search.
- **Private Media & File Sharing**: Drag-and-drop, clipboard paste, and picker uploads to private Supabase Storage buckets (`avatars` up to 5 MB; `chat-attachments` up to 15 MB) with binary magic-byte signature verification, XHR upload progress bars, `AbortController` upload cancellation, image lightbox, and authenticated short-lived signed URLs.
- **Presence, Typing & Notifications**: Ephemeral Supabase Realtime Presence (`everyone` / `contacts` / `nobody` visibility), privacy-filtered `last_seen_at`, auto-expiring typing broadcast indicators, customizable in-app toast + Web Audio chime alerts, and user-initiated browser notifications.
- **Safety & Moderation**: User discovery without exposing private email addresses, mutual block enforcement (`user_blocks`) preventing unwanted direct conversations/messages, structured abuse reporting (`reports`), and database-enforced rate limits (`rate_limit_events`).

---

## Security & Encryption Model

ASTERIAL Version 1.1 enforces defense-in-depth transport and database access controls:

1. **Transport & At-Rest Protection**: All client-server traffic is encrypted in transit over HTTPS/TLS and WSS, and persisted data is encrypted at rest by Supabase infrastructure. **Client-side end-to-end encryption (E2EE) is not enabled in Version 1.1**; ASTERIAL deliberately documents its exact security model rather than making unverified cryptographic claims.
2. **Mandatory Row Level Security (RLS)**: All 12 `public` tables (`profiles`, `user_presence_state`, `notification_preferences`, `conversations`, `conversation_members`, `messages`, `attachments`, `message_receipts`, `message_reactions`, `user_blocks`, `reports`, `rate_limit_events`) and `storage.objects` run with RLS enabled.
3. **Constrained Database Workflows**: Multi-table operations (atomic DM pair creation, group role transitions, receipt acknowledgements, trigram message search, and self-service account deletion) run through narrowly scoped `SECURITY DEFINER` PostgreSQL functions locked to `SET search_path = public, pg_temp`.
4. **Private Storage Isolation**: Neither `avatars` nor `chat-attachments` is public. Files are scoped by path (`{user_id}/...` and `{conversation_id}/{user_id}/...`), checked for binary header signatures prior to upload, and served via expiring signed URLs only to authorized conversation participants.
5. **Secret Hygiene**: `SUPABASE_SERVICE_ROLE_KEY` is optional, server-only (`import "server-only"`), and never exposed in `NEXT_PUBLIC_*` variables or client bundles.

---

## Application Routes

| Route | Access | Purpose |
| --- | --- | --- |
| `/` | Public | Product landing page, architecture overview, and release notes |
| `/login` | Public | Email & password sign-in |
| `/signup` | Public | Account creation with live `@username` uniqueness check |
| `/reset-password` | Public / Recovery | Password reset request & recovery credential update |
| `/auth/callback` | Public | PKCE / OTP authentication code exchange handler |
| `/privacy`, `/terms` | Public | Privacy Policy & Terms of Service |
| `/api/health` | Public | Service & runtime health endpoint (`GET`) |
| `/api/account/delete` | Authenticated | Confirmed permanent account deletion endpoint (`POST`) |
| `/app` | Protected | Redirects authenticated users to `/app/chats` |
| `/app/chats` | Protected | Workspace shell & conversation empty canvas |
| `/app/chats/[id]` | Protected | Real-time 1:1 or group conversation view + collapsible info drawer |
| `/app/contacts` | Protected | `@username` & display name user discovery, profile preview, block/report |
| `/app/groups` | Protected | Group conversations directory & group creation trigger |
| `/app/profile` | Protected | Identity editor (avatar, `@username`, display name, status, bio) |
| `/app/settings` | Protected | Security, Appearance, Notifications, Privacy, Blocked Users, Data & About |

---

## Environment Variables

Copy `.env.example` to `.env.local` and configure:

```bash
# Public client + server configuration
NEXT_PUBLIC_SUPABASE_URL=https://<your-project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-supabase-anon-or-publishable-key>
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Optional server-only admin key (fallback for /api/account/delete; NEVER prefix with NEXT_PUBLIC_)
SUPABASE_SERVICE_ROLE_KEY=<your-supabase-service-role-key>
```

---

## Database Migrations

Apply the SQL migrations in `supabase/migrations/` in exact chronological order:

1. `supabase/migrations/20261027165757_core_schema.sql` — Extensions (`pgcrypto`, `pg_trgm`), all 12 normalized tables, indexes, constraints, rate-limit ledger, message preview/unread/immutable-field triggers, and `auth.users` signup bootstrap trigger.
2. `supabase/migrations/20261027165842_rls_and_storage.sql` — Authorization helper functions, RLS policies for all 12 `public` tables, private `avatars` (5 MB) and `chat-attachments` (15 MB) buckets, `storage.objects` policies, and `supabase_realtime` table publication.
3. `supabase/migrations/20261027170005_rpc_workflows.sql` — Constrained `SECURITY DEFINER` RPC functions for onboarding, discovery, idempotent DMs, group lifecycle, delivery/read receipts, message search, presence touch, and account deletion.
4. `supabase/migrations/20261027172749_fix_account_delete_storage_guard.sql` — Uploader `DELETE` policy for `chat-attachments` via the Supabase Storage API and Storage-trigger-safe `delete_own_account()` cleanup.
5. `supabase/migrations/20261027172904_fix_message_update_guard_and_fk_cascade.sql` — Foreign-key `ON DELETE SET NULL` cascade compatibility and Storage-API-safe message soft-delete guard.

---

## Local Development & Verification

```bash
# Install dependencies
npm install

# Start development server (http://localhost:3000)
npm run dev

# Run unit & security validation tests
npm test

# Run strict TypeScript check & ESLint
npm run typecheck
npm run lint

# Build production bundle
npm run build
```

---

## Deploying to Vercel

1. Import the GitHub repository into Vercel with Framework Preset **Next.js**.
2. Configure `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_APP_URL` (your production domain), and optionally `SUPABASE_SERVICE_ROLE_KEY` (encrypted/sensitive, server-only) in **Project Settings → Environment Variables**.
3. In **Supabase → Authentication → URL Configuration**, include your Vercel domain (`https://<your-domain>.vercel.app/**`) in Redirect URLs.
4. Deploy and verify `https://<your-domain>.vercel.app/api/health`.

---

**ASTERIAL** · Version `1.1` · Official Developer: **Ritam Das** · **By X Huracan**
