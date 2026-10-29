# ASTERIAL — v1.4.5

**Messaging-first real-time communication, Close-Connections Orbits, Community Spaces, Moments & Community Feed across Web & Native Android.**  
**Official Developer:** Ritam Das · **Attribution:** By X Huracan  
**Production Website:** [https://asterial.vercel.app](https://asterial.vercel.app) · **Android Package:** `com.xhuracan.asterial`

---

## 1. Platform Architecture Overview

ASTERIAL delivers **two dedicated client applications** backed by **one shared Supabase PostgreSQL 17 backend**, **one shared TypeScript domain package (`@asterial/core`)**, and a clean **typed domain service layer (`src/lib/services/`)**:

| Product / Layer | Stack & Role |
| :--- | :--- |
| **Web Application (`/`)** | Next.js 16.4.3 (App Router), React 19.3, TypeScript 5.9 (`strict: true`), Tailwind CSS 4 — responsive 3-pane desktop & mobile bottom-navigation workspace deployed on Vercel (`https://asterial.vercel.app`) |
| **Typed Service Layer (`src/lib/services/`)** | Domain-separated modules (`auth`, `media`, `conversations`, `messages`, `groups`, `contacts`, `orbits`, `moments`, `feed`, `search`, `settings`, `errors`) keeping UI components declarative and error handling honest |
| **Native Android App (`mobile/`)** | Dedicated **React Native 0.83.10** + TypeScript (`com.xhuracan.asterial`), Fabric New Architecture + Hermes engine, Kotlin 2.1.20 (`AsterialNativeModule`), Gradle 9.0, Android SDK 36 (`minSdk 26`) — **100% native UI, zero WebView or website wrapper** |
| **Shared Core (`packages/core/`)** | `@asterial/core` — `v1.4.5` theme palettes (`obsidian`, `pitch`, `graphite`, `alabaster`, `system` + `resolveAppearanceTheme`), selective `ACCENT_PRESETS`, `CHAT_WALLPAPER_OPTIONS`, DB & social contracts, `classifyAuthError`, Zod v4 schemas, magic-byte file verification, and semver utilities |
| **Database & Authorization** | Supabase PostgreSQL 17 with Row Level Security (RLS) enforced across all **22** `public` tables (`0` tables without RLS), strict trigger guards (`before_message_update_guard`), and `SECURITY DEFINER` RPCs with `SET search_path = public, pg_temp` |
| **Realtime & Private Storage** | Supabase Realtime (`postgres_changes`, typing broadcast, privacy-aware presence) + 3 private Storage buckets (`avatars` 5 MB, `chat-attachments` 25 MB, `social-media` 25 MB) served exclusively via short-lived signed URLs |
| **CI/CD & Releases** | Vercel deploys Web; GitHub Actions (`.github/workflows/android-release.yml`) runs typechecks/lint/tests, preflights Supabase Auth TLS reachability, compiles & verifies standalone Universal + ABI-split (`arm64-v8a`, `armeabi-v7a`, `x86_64`) Hermes APKs, and publishes tag-driven (`v*.*.*`) GitHub Releases |

See [**`docs/ARCHITECTURE.md`**](./docs/ARCHITECTURE.md) for deep-dive system architecture and [**`docs/RELEASE.md`**](./docs/RELEASE.md) for the Android release runbook.

---

## 2. Centralized Versioning (`version.json`)

All version and attribution metadata is synchronized from [`version.json`](./version.json):
- `version`: `"1.4.5"` (`displayVersion`: `"1.4.5"`)
- `versionCode`: `14500` (CI computes monotonic Android `versionCode` offsets per workflow run)
- `androidPackageId`: `"com.xhuracan.asterial"`

```bash
npm run version:sync
npm run version:check
```

---

## 3. Key Capabilities in v1.4.5

- **Obsidian Design System & Responsive Navigation:** Deep-charcoal matte surfaces (`#090A0C` canvas, `#101216` sidebar, `#171A20` elevated cards), selective accent presets (`indigo`, `cobalt`, `emerald`, `amber`, `monochrome`), subtle chat wallpapers (`constellation`, `grid`, `aurora`, `none`), OS-aware `system` theme mode, message density (`comfortable` / `compact`), `reduced_motion`, and 6 primary workspace destinations (`Chats`, `Orbits`, `Moments`, `Feed`, `Contacts`, `Settings`).
- **Real-Time Messaging & Groups:** Ordered inbox (pins, mutes, archives, unread counters, live typing, `Draft:` indicators, Close Orbit badges); full conversation timeline (cursor pagination, date & `"Unread messages"` dividers, floating `"Latest"` jump button, honest `sending`/`sent`/`delivered`/`read`/`failed` states, replies, reactions, edit, soft-delete, multi-chat forwarding, server-enforced message pinning, in-chat search, `MediaRecorder` voice notes, and 25 MB image/video/audio/document attachments with progress/cancel/retry).
- **Orbits (Close Connections + Community Spaces):** Primary private **Close Connections** experience (`public.close_orbits` with strict `owner_id = auth.uid()` RLS, `inner` / `priority` tiers, private relationship notes, live presence, unread badges, and Quick Chat) alongside multi-channel **Community Spaces** (`/app/orbits/[orbitId]`).
- **Moments & Community Feed:** 6h–48h ephemeral photo, video (`MP4`/`WebM`), and tone-card Moments (`everyone`, `contacts`, or `orbit` audiences) with server-enforced expiration and viewer tracking; paginated Community Feed (`all`, `contacts`, `orbit`) with photo/video attachments, optimistic likes, post editing/deletion, and **threaded comment replies** (`parent_comment_id`).
- **Unified Search (`⌘K`):** Debounced server-filtered search across Users, Active Chats, Groups, Messages, Moments, and Feed Posts — never exposing private email addresses or phone numbers.
- **Privacy, Security & Account Portability:** Server-enforced presence/last-seen/read-receipt/DM controls, per-conversation mute manager, blocked-accounts manager, single-device or global (`Revoke all devices`) sign-out, portable **Account JSON Export**, and typed-confirmation permanent account deletion.

---

## 4. Environment Variables

Copy [`.env.example`](./.env.example) to `.env.local`:

| Variable | Scope | Description |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_SUPABASE_URL` | Public (Web & Mobile) | HTTPS Supabase project URL (`https://<project-ref>.supabase.co`) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public (Web & Mobile) | Public Supabase `anon` JWT or `sb_publishable_*` key (enforced by RLS) |
| `NEXT_PUBLIC_APP_URL` | Public (Web) | Canonical web origin (`https://asterial.vercel.app`) for auth callbacks |
| `SUPABASE_SERVICE_ROLE_KEY` | **Server-only** | Used strictly on the Next.js server where required; **never** exposed to browser or mobile bundles |
| `ANDROID_APP_SHA256_CERT_FINGERPRINTS` | Optional (Server) | Comma-separated SHA-256 signing fingerprints served at `/.well-known/assetlinks.json` |

---

## 5. Local Development & Verification

```bash
# Install dependencies across root Web/Core and native Android workspace
npm ci
npm --prefix mobile ci

# Run version parity, Web + Core + Mobile TypeScript checks, ESLint, and all unit/security tests
npm run check

# Build production Next.js Web bundle
npm run build

# Verify strict mobile config & Metro + Hermes bytecode bundle
npm run mobile:env:strict
```

---

## 6. Security & Scope Transparency

- **Transport, RLS & Private Storage:** All client-server traffic uses HTTPS/TLS and WSS. All **22** `public` tables enforce PostgreSQL 17 Row Level Security (`0` tables without RLS), and all 3 media buckets (`avatars`, `chat-attachments`, `social-media`) are private (`public = false`) with magic-byte upload validation and short-lived signed URLs.
- **Honest Cryptography Disclosure:** Client-side end-to-end cryptographic encryption (E2EE) is **not** enabled in `v1.4.5`; messages, media, and social updates are protected in transit via TLS and governed at rest by PostgreSQL RLS and private storage policies.
- **External Push Notification Scope:** Web notifications use the standard Browser `Notification` API when granted, and real-time in-app banners run over Supabase Realtime. Native background OS push delivery when the Android app process is terminated requires external Firebase Cloud Messaging (FCM) credentials, which are intentionally not fabricated.

---

**ASTERIAL v1.4.5** · Official Developer: **Ritam Das** · **By X Huracan**
