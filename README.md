# ASTERIAL — v1.3.0

**Precision real-time private messaging across Web & Native Android.**  
**Official Developer:** Ritam Das · **Attribution:** By X Huracan  
**Production Website:** [https://asterial.vercel.app](https://asterial.vercel.app) · **Android Package:** `com.xhuracan.asterial`

---

## 1. Two-Product Architecture Overview

ASTERIAL delivers **two separate client applications** backed by **one shared Supabase PostgreSQL 17 backend** and **one shared TypeScript domain package (`@asterial/core`)**:

| Product / Layer | Stack & Role |
| :--- | :--- |
| **Web Application (`/`)** | Next.js 16.4.3 (App Router), React 19.3, TypeScript 5.9 (`strict: true`), Tailwind CSS 4 — deployed on Vercel (`https://asterial.vercel.app`) |
| **Native Android App (`mobile/`)** | Dedicated **React Native 0.83.10** + TypeScript (`com.xhuracan.asterial`), Fabric New Architecture + Hermes engine, Kotlin 2.1.20 (`AsterialNativeModule`), Gradle 9.0, Android SDK 36 (`minSdk 26`) — **100% native UI, zero WebView or website wrapper** |
| **Shared Core (`packages/core/`)** | `@asterial/core` — centralized brand & theme palettes, Supabase DB contracts, Zod v4 validation schemas, auth deep-link parser, read-receipt privacy & messaging logic, binary header verification, and semver utilities |
| **Database & Authorization** | Supabase PostgreSQL 17 with Row Level Security (RLS) enforced across all 12 `public` tables + 17 `SECURITY DEFINER` RPCs and server-side triggers |
| **Realtime & Storage** | Supabase Realtime (`postgres_changes`, typing broadcast, presence) + private Storage buckets (`avatars` 5 MB, `chat-attachments` 15 MB) via short-lived signed URLs |
| **CI/CD & Releases** | Vercel auto-deploys Web; GitHub Actions (`.github/workflows/android-release.yml`) validates PRs/branches, compiles & verifies standalone Hermes APKs, and publishes tag-driven (`v*.*.*`) GitHub Releases |

See [**`docs/ARCHITECTURE.md`**](./docs/ARCHITECTURE.md) for the complete system architecture and [**`docs/RELEASE.md`**](./docs/RELEASE.md) for the repeatable tag-driven Android release runbook.

---

## 2. Centralized Versioning (`version.json`)

All version and attribution metadata lives in [`version.json`](./version.json):
- `version`: `"1.3.0"` (`displayVersion`: `"1.3.0"`)
- `versionCode`: `13000` (CI computes `13000 + github.run_number` for strictly monotonic Android upgrades)
- `androidPackageId`: `"com.xhuracan.asterial"`

Synchronize or verify alignment across `version.json`, `package.json`, `package-lock.json`, `packages/core/package.json`, `mobile/package.json`, `mobile/package-lock.json`, and `mobile/android/app/build.gradle`:

```bash
npm run version:sync
npm run version:check
```

---

## 3. Native Android (`mobile/`) Capabilities in v1.3.0

- **Direct Native Authentication & Onboarding:** Launches straight into native Sign In / Create Account (with live `@username` availability checks, password visibility toggle, password reset/recovery deep links `asterial://auth/callback`, `AsyncStorage` session persistence, expired-session detection, and incomplete-profile onboarding).
- **Real-Time 1:1 & Group Messaging Parity:** Shared Supabase conversations, idempotent direct chats, composite `(created_at, id)` keyset cursor pagination (`get_conversation_messages_page`), optimistic sending with `client_id` deduplication & retry, replies, emoji reactions, message editing, soft-delete/unsend (cleaning up private Storage objects), native clipboard copy, typing indicators, live presence, and mutual read-receipt privacy.
- **Native Attachments & Viewer (`AsterialNativeModule.kt`):** Scoped Android `ACTION_OPEN_DOCUMENT` picker (no broad storage permissions), binary magic-byte header verification via `@asterial/core`, chunked streaming uploads with live progress & cancellation, and native signed-URL image/document preview.
- **Contacts, Group Roles & Safety:** `@username` directory search, user profile sheets, group creation & role management (`owner` / `admin` / `member`), user blocking/unblocking, abuse reporting, 4 appearance themes (`Obsidian`, `OLED Pitch`, `Graphite`, `Alabaster Light`), and self-service account deletion.

---

## 4. Local Verification Commands

```bash
# Web + @asterial/core verification & production build
npm run version:check
npm run check
npm run build

# Dedicated React Native Android verification
npm --prefix mobile ci
npm run mobile:typecheck
npm run mobile:test
npm --prefix mobile run bundle:verify
```

---

## 5. Security, Privacy & Scope Honesty

- **Transport & Database Authorization:** All traffic uses HTTPS/TLS and WSS. Every exposed `public` table enforces PostgreSQL 17 Row Level Security (RLS), and private media uses short-lived signed URLs. `SUPABASE_SERVICE_ROLE_KEY` is never exposed to browser or mobile clients.
- **Honest Cryptography Disclosure:** Client-side end-to-end encryption (E2EE) is **not** enabled in v1.3.0; messages are stored in access-controlled Supabase PostgreSQL protected by strict RLS policies.
- **Scope Honesty:** Social feed/Orbits/Moments and background Firebase Cloud Messaging (FCM) push notifications are **not** enabled in v1.3.0 and are not advertised as active features.

---

**ASTERIAL v1.3.0** · Official Developer: **Ritam Das** · **By X Huracan**
