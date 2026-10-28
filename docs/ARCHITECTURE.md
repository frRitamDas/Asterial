# ASTERIAL — Multi-Product System Architecture (v1.4.0)

- **Product:** ASTERIAL (`v1.4.0`, `versionCode: 14000`)
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
   - Provides full v1.4.0 monochrome Web surfaces across Chats, Groups, Orbits (`/app/orbits`, `/app/orbits/[orbitId]`), Moments (`/app/moments`), Social Feed (`/app/feed`), Directory (`/app/contacts`), Profile, and Settings.

2. **Dedicated Native Android Application (`mobile/` — React Native 0.83 + TypeScript + Kotlin)**
   - Built with **React Native `0.83.10`** (New Architecture **Fabric** renderer + **Hermes** bytecode engine), Kotlin `2.1.20`, Gradle `9.0.0`, and Android SDK `36` (`minSdk 26`, `targetSdk 36`).
   - **Strict No-Wrapper Guarantee:** Contains **zero WebViews, zero iframes, and zero Capacitor/Cordova wrappers**. Opens directly into native authentication when signed out and provides full native parity across Chats, Groups, Orbits, Moments, Feed, People, Profile, and Settings.
   - Includes a first-party Kotlin `BaseReactPackage` (`AsterialNativeModule.kt` + `AsterialNativePackage.kt`) providing:
     - **Android `KeyStore` AES-256-GCM Secure Session Storage** (`secureGetItem` / `secureSetItem` / `secureRemoveItem`) with automatic legacy `AsyncStorage` migration and clean wipe on sign-out.
     - **Native TLS `HttpsURLConnection` Request Bridge (`nativeHttpsRequest`)** backing `asterialResilientFetch` when React Native's JS networking encounters transient Android DNS/socket errors.
     - **Scoped `ContentResolver` File Picker & Streaming Uploader** supporting `"avatar"`, `"attachment"`, and `"social-image"` kinds with magic-byte header validation, progress events, and cancellation.

---

## 2. Android Authentication Repair Architecture (v1.4.0)

In `v1.3.0`, `.github/workflows/android-release.yml` invoked `npm run mobile:typecheck` (`npm run mobile:env && tsc --noEmit`) with fallback environment variables `NEXT_PUBLIC_SUPABASE_URL='https://placeholder.supabase.co'` and `NEXT_PUBLIC_SUPABASE_ANON_KEY='public-anon-placeholder'`, overwriting `mobile/src/config/runtimeEnv.generated.ts` immediately prior to Gradle compiling `assets/index.android.bundle`. Installed APKs saw non-empty config strings, skipped `/api/mobile-config`, and sent auth requests to `placeholder.supabase.co` (`NXDOMAIN` -> `"Network request failed"`).

`v1.4.0` eliminates this class of failure across four layers:
1. **Build-Time & CI Guards:** `mobile:typecheck` uses `--if-missing`, `prepare-mobile-env.mjs` rejects placeholder/loopback/secret values and refuses to clobber valid configs, `mobile:env:strict` bootstraps verified public config from `/api/mobile-config` when needed, and CI preflights `${SUPABASE_URL}/auth/v1/health` (HTTP 200) and inspects compiled Hermes bytecode inside every built APK.
2. **Runtime Config Validation:** `isValidPublicSupabaseConfig` in `@asterial/core` validates URLs and `anon`/`sb_publishable_*` keys before creating any Supabase client.
3. **Resilient Transport & KeyStore Persistence:** `asterialResilientFetch` enforces a 15s timeout and falls back to native Kotlin `HttpsURLConnection` on network TypeError, paired with Android `network_security_config.xml` and `KeyStore` AES-256-GCM session storage.
4. **Actionable Diagnostics:** `classifyAuthError` maps invalid credentials, unconfirmed email, rate limits, offline/DNS errors, account conflicts, and expired refresh tokens into clear user guidance without leaking secrets.

---

## 3. Applied Supabase Migrations (`abbhynyhqxgllzsjaljo`)

All **21** `public` tables enforce Row Level Security (`rls_enabled = true`, `0` tables without RLS) across **8** additive migrations:
1. `20261027165757_core_schema.sql` — Core messaging, membership, receipts, reactions, blocks, reports, rate limits, and presence tables + indexes.
2. `20261027165842_rls_and_storage.sql` — Strict RLS policies + private `avatars` (5 MB) & `chat-attachments` (15 MB) Storage buckets + Realtime publication.
3. `20261027170005_rpc_workflows.sql` — Atomic `SECURITY DEFINER` RPC workflows (`create_or_get_direct_conversation`, `create_group_conversation`, `mark_conversation_read`, `search_users`, `search_messages`, etc.).
4. `20261027172749_fix_account_delete_storage_guard.sql` — Safe self-service `delete_own_account` RPC compatible with Supabase Storage API cleanup.
5. `20261027172904_fix_message_update_guard_and_fk_cascade.sql` — Message edit/soft-delete immutability trigger (`before_message_update_guard`).
6. `20261027174937_add_alabaster_theme_support.sql` — Adds `alabaster` light theme alongside `obsidian`, `pitch`, and `graphite`.
7. `20261028042447_v1_3_0_cursor_pagination_and_receipt_privacy.sql` — Adds `enforce_receipt_privacy_guard()`, `get_conversation_messages_page()`, and `get_inbox_page()`.
8. `20261028060954_v1_4_0_orbits_moments_and_social_feed.sql` — Adds `orbits`, `orbit_members`, `orbit_channels`, `orbit_messages`, `moments`, `moment_views`, `posts`, `post_likes`, `post_comments`, private `social-media` bucket (15 MB), extended `reports` target columns, RLS policies, Realtime publication entries, and 13 `SECURITY DEFINER` RPCs (`create_orbit_community`, `join_public_orbit`, `leave_orbit`, `create_orbit_channel`, `set_orbit_member_role`, `remove_orbit_member`, `get_orbit_messages_page`, `get_active_moments`, `record_moment_view`, `toggle_post_like`, `get_feed_posts_page`, etc.).
