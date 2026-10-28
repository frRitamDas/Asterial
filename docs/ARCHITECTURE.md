# ASTERIAL — Multi-Product System Architecture (v1.3.0)

- **Product:** ASTERIAL (`v1.3.0`, `versionCode: 13000`)
- **Official Developer:** Ritam Das
- **Brand Attribution:** By X Huracan
- **Production Website:** `https://asterial.vercel.app`
- **Android Application ID:** `com.xhuracan.asterial`
- **Shared Backend:** Supabase PostgreSQL 17 (`abbhynyhqxgllzsjaljo`, `eu-west-1`)

---

## 1. Two-Product Architectural Boundary

ASTERIAL consists of **two distinct client products** engineered against **one shared Supabase backend** and **one shared TypeScript domain layer (`@asterial/core`)**:

1. **Full-Stack Web Application (`/` — Next.js 16.4 App Router)**
   - Runs Next.js `16.4.3`, React `19.3.1`, TypeScript `5.9.3` (`strict: true`), and Tailwind CSS v4 at the repository root (`/`), preserving the live Vercel project configuration (`prj_GD0g3gWo7IDmuW21bykeeBYTIxTv`, `rootDirectory: null`).
   - Owns SSR session middleware (`src/proxy.ts`), OAuth/email confirmation callback (`/auth/callback`), Digital Asset Links (`/.well-known/assetlinks.json`), live GitHub Release verification (`/api/release`, `/download`), public client bootstrap (`/api/mobile-config`), and server-only privileged operations (`/api/account/delete`).

2. **Dedicated Native Android Application (`mobile/` — React Native 0.83 + TypeScript + Kotlin)**
   - Built with **React Native `0.83.10`** (New Architecture **Fabric** renderer + **Hermes** bytecode engine), Kotlin `2.1.20`, Gradle `9.0.0`, and Android SDK `36` (`minSdk 26`, `targetSdk 36`).
   - **Strict No-Wrapper Guarantee:** Contains **zero WebViews, zero iframes, and zero Capacitor/Cordova wrappers**. Opens directly into native authentication when signed out and provides full native 1:1 and group messaging parity with Web.
   - Includes a first-party Kotlin `BaseReactPackage` (`AsterialNativeModule.kt` + `AsterialNativePackage.kt`) for scoped `ContentResolver` file picking with raw magic-byte inspection, streaming `HttpsURLConnection` Supabase Storage uploads with progress & cancellation, native clipboard copy, live `ConnectivityManager` network events, and OS `PackageManager` version inspection.

```text
┌─────────────────────────────────────┐    ┌─────────────────────────────────────┐
│   Next.js 16.4 Web Application      │    │  React Native 0.83 Android App      │
│   (src/ · Vercel · Browser / SSR)   │    │  (mobile/ · Fabric + Hermes + Kotlin│
└──────────────────┬──────────────────┘    └──────────────────┬──────────────────┘
                   │                                          │
                   └──────────────┬────────────┬──────────────┘
                                  ▼            ▼
                   ┌──────────────────────────────────────────┐
                   │      @asterial/core (packages/core/)     │
                   │  Brand · Theme Tokens · DB Contracts     │
                   │  Auth Deep Links · Messaging & Privacy   │
                   │  Zod v4 Validation · Binary Header Guard │
                   └─────────────────────┬────────────────────┘
                                         │ HTTPS / WSS (Anon/Publishable JWT + User JWT)
                                         ▼
                   ┌──────────────────────────────────────────┐
                   │     Supabase Backend (PostgreSQL 17)     │
                   │  Auth · 12 RLS Tables · 17 RPCs          │
                   │  Realtime Channels · Private Storage     │
                   └──────────────────────────────────────────┘
```

---

## 2. Shared Cross-Platform Realtime & Messaging Protocol

Both Web (`src/components/workspace/WorkspaceProvider.tsx`, `src/components/chat/ConversationView.tsx`) and Native Android (`mobile/src/context/MobileWorkspaceContext.tsx`, `mobile/src/screens/ConversationScreen.tsx`) speak the **exact same Supabase Realtime & RPC protocol**:

- **Global Presence Channel (`asterial:presence`):** Tracks online state (`key: user.id`) when `profiles.presence_visibility !== 'nobody'` and heartbeats `touch_presence()` every 90 seconds.
- **Workspace Sync Channel (`asterial:workspace:${uid}`):** Subscribes to `conversation_members`, `conversations`, and incoming `messages` (`INSERT` -> invokes `acknowledge_delivery` automatically).
- **Active Thread Channel (`asterial:conv:${conversationId}`):** Broadcasts throttled `"typing"` events (`{ userId, displayName }`) and streams `postgres_changes` for `messages` (deduplicating optimistic sends via `client_id`), `attachments`, `message_reactions`, `message_receipts`, and `conversation_members`.
- **Composite Keyset Cursor Pagination (`get_conversation_messages_page`):** Queries `(created_at, id) < (p_before_created_at, p_before_id)` against `messages_conv_created_idx (conversation_id, created_at DESC, id DESC)` so burst messages with identical timestamps are never skipped or duplicated.
- **Server-Enforced Read-Receipt Privacy (`trg_enforce_receipt_privacy`):** Enforceable both in `mark_conversation_read()` and via `BEFORE INSERT OR UPDATE ON public.message_receipts`, guaranteeing `read_at` remains `NULL` whenever a recipient disables `read_receipts_enabled`.

---

## 3. Applied Supabase Migrations (`abbhynyhqxgllzsjaljo`)

All **12** `public` tables have Row Level Security (`rls_enabled = true`) across **7** applied migrations:
1. `20261027165757_core_schema.sql` — Core messaging, membership, receipts, reactions, blocks, reports, rate limits, and presence tables + indexes.
2. `20261027165842_rls_and_storage.sql` — Strict RLS policies + private `avatars` (5 MB) & `chat-attachments` (15 MB) Storage buckets + Realtime publication.
3. `20261027170005_rpc_workflows.sql` — Atomic `SECURITY DEFINER` RPC workflows (`create_or_get_direct_conversation`, `create_group_conversation`, `mark_conversation_read`, `search_users`, `search_messages`, etc.).
4. `20261027172749_fix_account_delete_storage_guard.sql` — Safe self-service `delete_own_account` RPC compatible with Supabase Storage API cleanup.
5. `20261027172904_fix_message_update_guard_and_fk_cascade.sql` — Message edit/soft-delete immutability trigger (`before_message_update_guard`).
6. `20261027174937_add_alabaster_theme_support.sql` — Adds `alabaster` light theme alongside `obsidian`, `pitch`, and `graphite`.
7. `20261028042447_v1_3_0_cursor_pagination_and_receipt_privacy.sql` — Adds `enforce_receipt_privacy_guard()`, `get_conversation_messages_page()`, and `get_inbox_page()`.

---

## 4. Security, Release Integrity & Scope Boundaries

- **Secret Isolation:** `SUPABASE_SERVICE_ROLE_KEY` is never read or returned by client bundles, `scripts/prepare-mobile-env.mjs`, or `/api/mobile-config` (enforced and unit-tested via `sanitizePublicAnonKey`).
- **Tag-Driven GitHub Release Pipeline:** `.github/workflows/android-release.yml` validates PRs and ordinary branch commits without creating releases, and publishes official GitHub Releases only on unique canonical `v*.*.*` tags matching `version.json`, verifying Hermes bytecode (`c61fbc03c103191f`), `apksigner` signatures, and `.sha256` checksums.
- **Explicit Scope Boundaries (v1.3.0):** Social feed/posts/follows, Orbits/Moments, client-side E2EE, and background FCM push notifications are not implemented in v1.3.0 and are never claimed as active features in the UI or documentation.
