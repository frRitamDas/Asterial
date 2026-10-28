# ASTERIAL — v1.4.0

**Full-stack monochrome real-time messaging, Orbits, Moments & Social Feed across Web & Native Android.**  
**Official Developer:** Ritam Das · **Attribution:** By X Huracan  
**Production Website:** [https://asterial.vercel.app](https://asterial.vercel.app) · **Android Package:** `com.xhuracan.asterial`

---

## 1. Two-Product Architecture Overview

ASTERIAL delivers **two separate client applications** backed by **one shared Supabase PostgreSQL 17 backend** and **one shared TypeScript domain package (`@asterial/core`)**:

| Product / Layer | Stack & Role |
| :--- | :--- |
| **Web Application (`/`)** | Next.js 16.4.3 (App Router), React 19.3, TypeScript 5.9 (`strict: true`), Tailwind CSS 4 — deployed on Vercel (`https://asterial.vercel.app`) |
| **Native Android App (`mobile/`)** | Dedicated **React Native 0.83.10** + TypeScript (`com.xhuracan.asterial`), Fabric New Architecture + Hermes engine, Kotlin 2.1.20 (`AsterialNativeModule`), Gradle 9.0, Android SDK 36 (`minSdk 26`) — **100% native UI, zero WebView or website wrapper** |
| **Shared Core (`packages/core/`)** | `@asterial/core` — monochrome v1.4.0 theme palettes (`obsidian`, `pitch`, `graphite`, `alabaster`), Supabase DB & social contracts, auth config & error classification (`classifyAuthError`), Zod v4 validation schemas, auth deep-link parser, read-receipt privacy, binary header verification, and semver utilities |
| **Database & Authorization** | Supabase PostgreSQL 17 with Row Level Security (RLS) enforced across all **21** `public` tables (`0` tables without RLS) + 30 `SECURITY DEFINER` RPCs and server-side triggers |
| **Realtime & Storage** | Supabase Realtime (`postgres_changes`, typing broadcast, presence) + private Storage buckets (`avatars` 5 MB, `chat-attachments` 15 MB, `social-media` 15 MB) via short-lived signed URLs |
| **CI/CD & Releases** | Vercel auto-deploys Web; GitHub Actions (`.github/workflows/android-release.yml`) validates PRs/branches, preflights Supabase Auth TLS reachability, compiles & verifies standalone Universal + ABI-split (`arm64-v8a`, `armeabi-v7a`, `x86_64`) Hermes APKs, and publishes tag-driven (`v*.*.*`) GitHub Releases |

See [**`docs/ARCHITECTURE.md`**](./docs/ARCHITECTURE.md) for the complete system architecture and [**`docs/RELEASE.md`**](./docs/RELEASE.md) for the repeatable tag-driven Android release runbook.

---

## 2. Centralized Versioning (`version.json`)

All version and attribution metadata lives in [`version.json`](./version.json):
- `version`: `"1.4.0"` (`displayVersion`: `"1.4.0"`)
- `versionCode`: `14000` (CI computes `14000 + github.run_number` for strictly monotonic Android upgrades above all prior `130xx` builds)
- `androidPackageId`: `"com.xhuracan.asterial"`

Synchronize or verify alignment across `version.json`, `package.json`, `package-lock.json`, `packages/core/package.json`, `mobile/package.json`, `mobile/package-lock.json`, and `mobile/android/app/build.gradle`:

```bash
npm run version:sync
npm run version:check
```

---

## 3. What's New in v1.4.0

- **Android Authentication Root-Cause Fix (`"Network request failed"`):** Hardened `scripts/prepare-mobile-env.mjs` (`--if-missing` & `--require-valid` + verified `/api/mobile-config` build-time bootstrap), decoupled `mobile:typecheck` from overwriting `runtimeEnv.generated.ts` with CI placeholders, added Android `network_security_config.xml` + `asterialResilientFetch` (with native Kotlin `HttpsURLConnection` fallback), upgraded session storage to Android `KeyStore` AES-256-GCM (`AsterialNativeModule.kt`), and added live TLS Auth connectivity diagnostics + categorized `classifyAuthError` messages.
- **Complete Premium Monochrome UI/UX Overhaul:** Deep obsidian/OLED black/charcoal & crisp alabaster light surfaces across Web and React Native Android, high-contrast white/zinc typography, subtle hairline borders, zero excessive glassmorphism or decorative glow gimmicks, and full `reduced_motion` support.
- **Orbits (Community Spaces):** Dedicated community backend (`orbits`, `orbit_members`, `orbit_channels`, `orbit_messages`) with public/private visibility, `owner` / `admin` / `member` server-enforced roles, multi-channel real-time messaging (`#general`, `#announcements`, custom channels), keyset cursor pagination, member moderation, and private attachments.
- **Moments (Ephemeral Updates):** 6h / 12h / 24h / 48h text & image updates (`moments`, `moment_views`) with `everyone` or `contacts` audiences, monochrome tone cards, view tracking (`record_moment_view`), and server-enforced expiry in both PostgreSQL RLS (`expires_at > now()`) and private `social-media` signed URL policies.
- **Social Feed:** Chronological persistent posts (`posts`, `post_likes`, `post_comments`) with composite `(created_at DESC, id DESC)` cursor pagination (`get_feed_posts_page`), atomic `toggle_post_like`, threaded comments, post editing & soft-deletion, block filtering, and abuse reporting.

---

## 4. Local Verification Commands

```bash
# Full cross-workspace verification & Next.js production build
npm run check
npm run build

# React Native Android strict config & Metro production bundle verification
npm run mobile:env:strict
npm --prefix mobile run bundle:verify
```

---

## 5. Security, Privacy & Scope Honesty

- **Transport & Database Authorization:** All traffic uses HTTPS/TLS and WSS. Every exposed `public` table (`21/21`) enforces PostgreSQL 17 Row Level Security (RLS), and private media (`avatars`, `chat-attachments`, `social-media`) uses short-lived signed URLs. `SUPABASE_SERVICE_ROLE_KEY` and `sb_secret_*` keys are strictly rejected from client/mobile bundles.
- **Honest Cryptography & Retention Disclosure:** Client-side end-to-end encryption (E2EE) is **not** enabled in v1.4.0; messages and social content are protected by HTTPS/TLS in transit and PostgreSQL RLS at rest. Expired Moments are immediately blocked from API queries and signed Storage access (`expires_at > now()`), while underlying infrastructure backups follow standard database retention schedules.

---

**ASTERIAL v1.4.0** · Official Developer: **Ritam Das** · **By X Huracan**
