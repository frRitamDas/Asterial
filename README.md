# ASTERIAL — v1.2.0

**Precision real-time messaging & social platform foundation across Web & Native Android.**  
**Official Developer:** Ritam Das · **Attribution:** By X Huracan  
**Production Website:** [https://asterial.vercel.app](https://asterial.vercel.app) · **Android Package:** `com.xhuracan.asterial`

---

## 1. Two-Product Architecture Overview

ASTERIAL delivers **two separate client applications** backed by **one shared Supabase PostgreSQL 17 backend** and **one shared TypeScript domain package (`@asterial/core`)**:

| Product / Layer | Stack & Role |
| :--- | :--- |
| **Web Application (`/`)** | Next.js 16.4.3 (App Router), React 19.3, TypeScript 5.9 (`strict: true`), Tailwind CSS 4 — deployed on Vercel (`https://asterial.vercel.app`) |
| **Native Android App (`mobile/`)** | Dedicated **React Native 0.83.10** + TypeScript (`com.xhuracan.asterial`), Fabric New Architecture + Hermes engine, Kotlin 2.1.20, Gradle 9.0, Android SDK 36 (`minSdk 24`) — **100% native UI, zero WebView or website wrapper** |
| **Shared Core (`packages/core/`)** | `@asterial/core` — centralized brand & theme palettes, Supabase DB & social contracts, Zod v4 validation schemas, binary header verification, and semver utilities |
| **Database & Authorization** | Supabase PostgreSQL 17 with Row Level Security (RLS) enforced across all 12 `public` tables + `SECURITY DEFINER` RPCs |
| **Realtime & Storage** | Supabase Realtime (`postgres_changes`, typing broadcast, presence) + private Storage buckets (`avatars` 5 MB, `chat-attachments` 15 MB) via short-lived signed URLs |
| **CI/CD & Releases** | Vercel auto-deploys Web; GitHub Actions (`.github/workflows/android-release.yml`) verifies `@asterial/core`, Web, and `mobile/`, then compiles & verifies `asterial-android-<version>.apk` |

See [**`docs/ARCHITECTURE.md`**](./docs/ARCHITECTURE.md) for the complete system architecture, repository layout, RLS security model, and non-destructive Phase 2+ messaging & social schema roadmap.

---

## 2. Centralized Versioning (`version.json`)

All version and attribution metadata lives in [`version.json`](./version.json):
- `version`: `"1.2.0"` (`displayVersion`: `"1.2"`)
- `versionCode`: `12000` (CI computes `12000 + github.run_number` for strictly monotonic Android upgrades)
- `androidPackageId`: `"com.xhuracan.asterial"`

Synchronize or verify alignment across `version.json`, `package.json`, `packages/core/package.json`, and `mobile/package.json`:

```bash
npm run version:sync
npm run version:check
```

---

## 3. Local Development & Verification

### Web + Shared Core (`/`, `packages/core/`)
1. Copy `.env.example` to `.env.local` and configure your Supabase credentials:
   ```bash
   cp .env.example .env.local
   ```
2. Install dependencies and start the Next.js development server:
   ```bash
   npm ci
   npm run dev
   ```
3. Run the multi-package verification & production build suite:
   ```bash
   npm run check     # version:check + web/core tsc + eslint (web, core, mobile) + unit tests
   npm run build     # production Next.js build
   ```

### Dedicated React Native Android App (`mobile/`)
1. Install React Native dependencies (automatically generates gitignored `mobile/src/config/runtimeEnv.generated.ts` from public `.env.local` variables):
   ```bash
   npm --prefix mobile ci
   ```
2. Run strict TypeScript checks, unit tests, and Metro production bundle verification:
   ```bash
   npm run mobile:typecheck
   npm run mobile:test
   npm --prefix mobile run bundle:verify
   ```
3. Compile an installable standalone APK locally (requires Temurin JDK 17, Android SDK 36, Build-Tools 36.0.0, NDK `27.1.12297006`, and CMake `3.22.1`):
   ```bash
   cd mobile/android
   CI=true ./gradlew assembleDebug
   # Output: mobile/android/app/build/outputs/apk/debug/app-debug.apk
   ```

---

## 4. Automated Android APK & Release Pipeline

Workflow: [`.github/workflows/android-release.yml`](./.github/workflows/android-release.yml)

- **Repository Variables (Public Client Config for CI APKs):**
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- **Optional Repository Secrets for Production Keystore Signing:**
  - `ANDROID_KEYSTORE_BASE64` — `base64 -w 0 ~/asterial-release.jks` (never commit keystores to Git)
  - `ANDROID_KEYSTORE_PASSWORD`
  - `ANDROID_KEY_ALIAS`
  - `ANDROID_KEY_PASSWORD`
- **Optional Vercel Env Var for Verified Android App Links:**
  - `ANDROID_APP_SHA256_CERT_FINGERPRINTS` — comma-separated SHA-256 certificate fingerprint(s) served at `https://asterial.vercel.app/.well-known/assetlinks.json`.
- **Honest Signing Behavior:** When `ANDROID_KEYSTORE_*` secrets are absent or on Pull Requests, CI builds a standalone Hermes-bundled debug-signed APK, verifies both the embedded `assets/index.android.bundle` and APK signature via `apksigner`, and explicitly labels the artifact as debug-signed.

---

## 5. Security, Privacy & Transparency

- **Transport & Database Authorization:** All traffic uses HTTPS/TLS and WSS. Every exposed `public` table enforces PostgreSQL 17 Row Level Security (RLS), and attachments use private signed URLs. `SUPABASE_SERVICE_ROLE_KEY` is never exposed to browser or mobile clients.
- **Honest Cryptography Disclosure:** Client-side end-to-end encryption (E2EE) is **not** enabled in v1.2; messages are stored in access-controlled Supabase PostgreSQL protected by strict RLS policies.
- **Notifications:** Foreground real-time toasts, sound cues, and Web Notification API alerts are supported on Web while open. Native Android background push delivery via FCM is planned for Phase 4 and is not claimed until Firebase Cloud Messaging infrastructure is configured.

---

**ASTERIAL v1.2.0** · Official Developer: **Ritam Das** · **By X Huracan**
