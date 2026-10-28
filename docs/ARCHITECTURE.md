# ASTERIAL — Multi-Product System Architecture (Phase 1 Foundation)

- **Product:** ASTERIAL (`v1.2.0`, `versionCode: 12000`)
- **Official Developer:** Ritam Das
- **Brand Attribution:** By X Huracan
- **Production Website:** `https://asterial.vercel.app`
- **Android Application ID:** `com.xhuracan.asterial`
- **Shared Backend:** Supabase PostgreSQL 17 (`abbhynyhqxgllzsjaljo`, `eu-west-1`)

---

## 1. Two-Product Architectural Boundary

ASTERIAL consists of **two distinct client products** engineered against **one shared Supabase backend** and **one shared TypeScript domain layer (`@asterial/core`)**:

1. **Full-Stack Web Application (`/` — Next.js 16.4 App Router)**
   - Runs Next.js `16.4.3`, React `19.3.1`, TypeScript `5.9.3` (`strict: true`), and Tailwind CSS v4 at the repository root (`/`), preserving the live Vercel project configuration (`prj_GD0g3gWo7IDmuW21bykeeBYTIxTv`, `rootDirectory: null`) and all existing real-time messaging routes without disruptive directory relocation.
   - Owns SSR session middleware (`src/proxy.ts`), OAuth/email confirmation callback (`/auth/callback`), Digital Asset Links (`/.well-known/assetlinks.json`), release telemetry (`/api/release`, `/api/health`), and server-only privileged operations (`/api/account/delete`).

2. **Dedicated Native Android Application (`mobile/` — React Native 0.83 + TypeScript)**
   - Built with **React Native `0.83.10`** (New Architecture **Fabric** renderer + **Hermes** bytecode engine), Kotlin `2.1.20`, Gradle `9.0.0`, and Android SDK `36` (`minSdk 24`, `targetSdk 36`).
   - **Strict No-Wrapper Guarantee:** Contains **zero WebViews, zero iframes, and zero Capacitor/Cordova wrappers**. Every screen renders native Android `View`, `Text`, `TextInput`, and `Pressable` components compiled into a standalone APK (`com.xhuracan.asterial`).
   - Connects directly to the same Supabase Auth, PostgreSQL RLS tables, Realtime channels, and private Storage buckets as the website, persisting user sessions natively via `@react-native-async-storage/async-storage` and refreshing tokens on `AppState` foreground transitions.

```text
┌─────────────────────────────────────┐    ┌─────────────────────────────────────┐
│   Next.js 16.4 Web Application      │    │  React Native 0.83 Android App      │
│   (src/ · Vercel · Browser / SSR)   │    │  (mobile/ · Fabric + Hermes APK)    │
└──────────────────┬──────────────────┘    └──────────────────┬──────────────────┘
                   │                                          │
                   └──────────────┬────────────┬──────────────┘
                                  ▼            ▼
                   ┌──────────────────────────────────────────┐
                   │      @asterial/core (packages/core/)     │
                   │  Brand · Theme Tokens · DB & Social Types│
                   │  Zod v4 Validation · Binary Header Guard │
                   └─────────────────────┬────────────────────┘
                                         │ HTTPS / WSS (Anon/Publishable JWT + User JWT)
                                         ▼
                   ┌──────────────────────────────────────────┐
                   │     Supabase Backend (PostgreSQL 17)     │
                   │  Auth · 12 RLS Tables · SECURITY DEFINER │
                   │  Realtime Channels · Private Storage     │
                   └──────────────────────────────────────────┘
```

---

## 2. Repository Structure & Dependency Isolation

```text
Asterial/
├── src/                        # Next.js 16.4 full-stack web application
│   ├── app/                    # App Router pages & server Route Handlers
│   ├── components/             # Web UI, real-time messaging & release metadata panels
│   └── lib/                    # Supabase SSR/browser clients + @asterial/core re-exports
├── packages/
│   └── core/                   # @asterial/core — runtime-neutral TypeScript package
│       ├── src/constants/      # Brand metadata & 4 shared appearance palettes
│       ├── src/types/          # Supabase DB contracts + Phase 2+ social graph contracts
│       ├── src/validation/     # Zod v4 schemas + Uint8Array binary magic-byte checks
│       ├── src/utils/          # Formatting & filename sanitization helpers
│       └── src/version/        # Semver & Android versionCode comparison helpers
├── mobile/                     # Dedicated React Native 0.83 TypeScript Android product
│   ├── android/                # Native Kotlin + Gradle 9.0 project (com.xhuracan.asterial)
│   ├── src/                    # Native screens, AsyncStorage Supabase client, theme tokens
│   ├── metro.config.js         # Resolves @asterial/core while isolating React versions
│   └── package.json            # Mobile-scoped dependencies (React 19.2.0 + RN 0.83.10)
├── supabase/
│   └── migrations/             # Ordered PostgreSQL 17 schema, RPC, trigger & RLS migrations
├── scripts/
│   ├── prepare-mobile-env.mjs  # Generates gitignored public-only mobile runtime config
│   ├── sync-version.mjs        # Verifies/syncs version.json across /, packages/core & mobile
│   └── generate-brand-assets.py# Deterministic brand & Android mipmap icon generator
├── .github/workflows/
│   └── android-release.yml     # Multi-product CI + standalone React Native APK pipeline
└── version.json                # Single source of truth for semver, versionCode & attribution
```

### Why `mobile/` Uses Isolated `node_modules` Instead of Root Hoisting
Next.js `16.4.3` runs against `react@19.3.1`, whereas React Native `0.83.10` locks its renderer tightly to `react@19.2.0`. Keeping `mobile/package.json` isolated and configuring `mobile/metro.config.js` to block root `node_modules/react` and `node_modules/react-dom` guarantees zero dual-React hook collisions while allowing both Next.js (`transpilePackages: ["@asterial/core"]`) and Metro (`watchFolders` + `extraNodeModules`) to compile `@asterial/core` directly from TypeScript source.

---

## 3. Shared Supabase Backend (`abbhynyhqxgllzsjaljo`)

### 3.1 Current Verified Production Schema (Phase 1 Preserved)
All **12** `public` tables in Supabase PostgreSQL `17.11.0.003` have **Row Level Security (`rls_enabled = true`)** enforced across **32** active policies (`6` applied migrations, `20261027165757`–`20261027174937`):

| Domain | Tables & Storage Buckets | Authorization & Integrity Rules |
| :--- | :--- | :--- |
| **Identity & Preferences** | `profiles`, `notification_preferences`, `user_contacts`, `blocked_users` | Self-owned write policies (`auth.uid() = id` / `user_id`); `profiles` readable by authenticated users; block rules enforced in RPCs. |
| **Conversations & Membership** | `conversations`, `conversation_members`, `conversation_user_state` | Scoped strictly to active members via `is_active_conversation_member(conversation_id)` and `SECURITY DEFINER` RPCs (`create_or_get_direct_conversation`, `create_group_conversation`). |
| **Messages & Interactions** | `messages`, `message_attachments`, `message_reactions`, `message_receipts`, `message_hidden` | Trigger-guarded edits/unsends (`before_message_update_guard`), active-member read/write RLS, per-user local hide (`message_hidden`). |
| **Private Media Storage** | `avatars` (5 MB), `chat-attachments` (15 MB) | Both buckets are private (`public = false`) with MIME allowlists and short-lived signed URLs; binary magic-byte headers verified before upload via `@asterial/core`. |

### 3.2 Non-Destructive Phase 2+ Schema & RLS Expansion Plan
No destructive schema changes are ever permitted against production data. Phase 2 and Phase 3 will extend the existing schema exclusively through **additive migrations** matching the TypeScript contracts already defined in `packages/core/src/types/social.ts`:

1. **Social Graph (`public.follows`)**
   - Columns: `(follower_id uuid, following_id uuid, status text CHECK (status IN ('accepted', 'pending')), created_at timestamptz)` with PK `(follower_id, following_id)` and `CHECK (follower_id <> following_id)`.
   - RLS: Authenticated read when neither party has blocked the other (`NOT EXISTS` check on `public.blocked_users`); insert/delete restricted to `follower_id = auth.uid()`; status transition (`pending -> accepted`) restricted to `following_id = auth.uid()`.

2. **Social Feed & Threads (`public.posts`, `public.post_media`, `public.post_likes`, `public.post_bookmarks`, `public.post_comments`)**
   - `posts`: `id`, `author_id`, `body` (`1..2000` chars validated via `@asterial/core` `createPostSchema`), `visibility` (`'public' | 'followers' | 'private'`), `reply_to_post_id`, `repost_of_post_id`, denormalized trigger-maintained counters (`like_count`, `comment_count`, `repost_count`), `created_at`, `edited_at`, `deleted_at`.
   - `post_media` + Storage bucket `post-media`: Ordered image/video attachments with width/height/duration metadata and signed URL access respecting parent post visibility.
   - RLS: `SELECT` allowed when `deleted_at IS NULL`, no block exists between viewer and author, and (`visibility = 'public'`, `author_id = auth.uid()`, or `visibility = 'followers'` with an accepted `follows` edge). Mutations restricted to `author_id = auth.uid()`.

3. **Unified Activity Notifications & Native Push Delivery (`public.notifications`, `public.push_device_tokens`)**
   - `notifications`: Unified inbox for mentions, replies, reactions, and follows (`recipient_id = auth.uid()` RLS + Realtime channel).
   - `push_device_tokens`: Stores per-device FCM tokens (`platform IN ('android', 'ios', 'web')`, RLS `user_id = auth.uid()`). Background push notifications will only be advertised once Firebase Cloud Messaging (`google-services.json` + Supabase Edge Function dispatcher) is configured.

4. **Messaging Scale & Rich Media Indexes**
   - Additive composite cursor index on `messages (conversation_id, created_at DESC, id DESC)` for keyset pagination across Web and React Native `FlatList`.
   - Voice-note / video duration & waveform metadata columns (`duration_ms integer NULL`) on `message_attachments`.

---

## 4. Security & Operational Honesty Rules

- **Secret Isolation:** `SUPABASE_SERVICE_ROLE_KEY` exists **only** on the server runtime (Vercel server env) for `/api/account/delete`. `scripts/prepare-mobile-env.mjs` reads **exclusively** public variables (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_APP_URL`) into gitignored `mobile/src/config/runtimeEnv.generated.ts`.
- **Encryption Transparency:** All client-to-Supabase traffic uses HTTPS (TLS 1.3) and WSS, and PostgreSQL/Storage enforce strict RLS and encryption at rest. Client-side end-to-end encryption (E2EE) is **not** implemented and must never be claimed unless a real audited device-key protocol is shipped.
- **APK Signing Transparency:** No keystore (`*.jks` / `*.keystore`) is ever committed to Git. When `ANDROID_KEYSTORE_*` repository secrets are absent or on Pull Requests, CI builds a standalone debug-signed APK (`apksigner` verified) and explicitly labels it as debug-signed in the manifest, job summary, and release notes.

---

## 5. Build, Verification & Deployment Pipelines

### 5.1 Local Engineering Commands
```bash
# Synchronize or verify centralized version metadata (version.json -> /, packages/core, mobile)
npm run version:sync
npm run version:check

# Verify Web + @asterial/core (typecheck, ESLint across src + packages/core + mobile, unit tests)
npm run check
npm run build

# Verify Dedicated React Native Android App (mobile/)
npm --prefix mobile ci
npm run mobile:typecheck
npm run mobile:test
npm --prefix mobile run bundle:verify
```

### 5.2 Web Deployment (Vercel)
- **Project:** `prj_GD0g3gWo7IDmuW21bykeeBYTIxTv` (`https://asterial.vercel.app`, `rootDirectory: null`, Node `24.x`).
- **Environment Variables:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (server-only), `NEXT_PUBLIC_APP_URL`, and optional `ANDROID_APP_SHA256_CERT_FINGERPRINTS` for verified Android App Links.

### 5.3 Android APK Pipeline (GitHub Actions)
- **Workflow:** `.github/workflows/android-release.yml`
- **Toolchain:** Node.js `22`, Temurin JDK `17` (matching `@react-native/gradle-plugin@0.83.10` Kotlin JVM toolchain), Android SDK Platform `36`, Build-Tools `36.0.0`, NDK `27.1.12297006`, CMake `3.22.1`, Gradle `9.0.0`.
- **Standalone APK Guarantee:** `CI=true` sets `debuggableVariants = []` in `mobile/android/app/build.gradle` so even debug-signed CI APKs embed the compiled Hermes bundle (`assets/index.android.bundle`) — verified automatically via `unzip -l` and `apksigner verify --verbose` before artifact upload.
- **Recommended GitHub Actions Configuration:**
  - **Repository Variables** (`Settings -> Secrets and variables -> Actions -> Variables`): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (embeds live Supabase endpoint into CI-built APKs).
  - **Repository Secrets** (`Settings -> Secrets and variables -> Actions -> Secrets`): `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD` (enables V1/V2/V3 production-signed `assembleRelease` builds on `main` and `v*` tags).

---

## 6. Phase 2+ Execution Roadmap

- **Phase 2 — Native Android Messaging Parity:** Implement native React Native navigation, sign-up & password recovery, real-time conversation inbox, 1:1 & group chat screen (`FlatList` inverted keyset pagination, replies, reactions, edits, unsend, typing & presence), private attachment upload/viewer, and contact/block management against the existing Supabase schema.
- **Phase 3 — Social Networking Platform (Web + Android):** Apply additive PostgreSQL migrations (`follows`, `posts`, `post_media`, `post_likes`, `post_bookmarks`, `post_comments`, `notifications`) with strict RLS, shared `@asterial/core` schemas/helpers, and synchronized social feed, profile, and composer experiences across both Next.js Web and React Native Android.
- **Phase 4 — Production Signing, Push & App Links:** Configure production Android release keystore secrets, `ANDROID_APP_SHA256_CERT_FINGERPRINTS` for verified HTTPS deep links, and Firebase Cloud Messaging (`push_device_tokens` + Supabase Edge Function).
