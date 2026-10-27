# ASTERIAL — v1.2.0

**Precision real-time messaging across Web & Android.**  
**Official Developer:** Ritam Das · **Attribution:** By X Huracan  
**Production Website:** [https://asterial.vercel.app](https://asterial.vercel.app) · **Android Package:** `com.xhuracan.asterial`

---

## 1. Architecture Overview

ASTERIAL unifies desktop/mobile browsers, installable PWA surfaces, and the Android application on a **single shared Supabase backend**:

| Layer | Stack & Role |
| :--- | :--- |
| **Web Application** | Next.js 16.4 (App Router), React 19, TypeScript 5.9 (`strict: true`), Tailwind CSS 4 |
| **Android Application** | Capacitor 8 (`@capacitor/android`, `com.xhuracan.asterial`), JDK 21, Android SDK 36 (`minSdkVersion 24`), native App/StatusBar/Keyboard/Network/Share/Browser bridge + bundled local offline recovery shell (`mobile-shell/`) |
| **Database & Authorization** | Supabase PostgreSQL 17 with Row Level Security (RLS) enforced on all 12 `public` tables + `SECURITY DEFINER` RPCs |
| **Realtime Engine** | Supabase Realtime `postgres_changes` (messages, edits, receipts, membership), broadcast typing indicators, and live presence |
| **Media & Storage** | Private Supabase Storage buckets (`avatars` 5 MB, `chat-attachments` 15 MB) served exclusively via short-lived signed URLs |
| **CI/CD & Hosting** | Vercel auto-deploys `main` for Web; GitHub Actions (`.github/workflows/android-release.yml`) validates Web + compiles/signs `asterial-android-<version>.apk` |

### Why Capacitor 8 HTTPS Shell + Native Bridge (Option A)?
ASTERIAL relies on Next.js Server Components, SSR cookie session refresh (`/auth/callback`), and server-only Route Handlers (`/api/account/delete` using `SUPABASE_SERVICE_ROLE_KEY`, `/api/release`, `/api/health`, `/.well-known/assetlinks.json`). Forcing `output: "export"` would break SSR auth callbacks and server-side account erasure, while duplicating the app in standalone Kotlin would fragment feature parity. Using Capacitor 8 pointed to `https://asterial.vercel.app` with strict origin allowlisting (`allowNavigation: ["asterial.vercel.app", "localhost"]`), HTTPS-only `network_security_config.xml`, native Android hardware back/status-bar/keyboard/network/share hooks, and a bundled local offline recovery screen (`mobile-shell/offline.html`) preserves 100% shared backend & UI parity while delivering native Android ergonomics.

---

## 2. Centralized Versioning (`version.json`)

All version metadata lives in [`version.json`](./version.json):
- `version`: `"1.2.0"` (`displayVersion`: `"1.2"`)
- `versionCode`: `12000` (CI automatically computes `12000 + github.run_number` for strictly monotonic Android upgrades)
- `androidPackageId`: `"com.xhuracan.asterial"`

Synchronize or verify metadata across `version.json` and `package.json`:

```bash
npm run version:sync
npm run version:check
```

---

## 3. Local Web Development

1. Copy `.env.example` to `.env.local` and configure your Supabase credentials:
   ```bash
   cp .env.example .env.local
   ```
2. Install dependencies and start the development server:
   ```bash
   npm ci
   npm run dev
   ```
3. Run the verification suite:
   ```bash
   npm run check     # version:check + tsc --noEmit + eslint + unit tests
   npm run build     # production Next.js build
   ```

---

## 4. Building & Signing the Android APK

### Sync Native Android Project
```bash
npm run cap:sync
```

### Local Debug Build (Installable Verification APK)
Requires JDK 21 and Android SDK 36 (`ANDROID_HOME` configured):
```bash
cd android
./gradlew assembleDebug
# Output: android/app/build/outputs/apk/debug/app-debug.apk
```

### Production Keystore Creation (Keep Outside Git!)
Generate a private release keystore **outside** the repository (all `*.jks` / `*.keystore` files are gitignored):
```bash
keytool -genkeypair -v \
  -keystore ~/asterial-release.jks \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -alias asterial
```

### GitHub Actions Automated APK & Release Pipeline
Workflow: [`.github/workflows/android-release.yml`](./.github/workflows/android-release.yml)

- **Triggers:** Push to `main`, version tags (`v*`), Pull Requests targeting `main` (validation + debug APK artifact only; never exposes signing secrets or publishes releases), and manual `workflow_dispatch`.
- **Optional GitHub Repository Secrets for Production Signing:**
  - `ANDROID_KEYSTORE_BASE64` — `base64 -w 0 ~/asterial-release.jks`
  - `ANDROID_KEYSTORE_PASSWORD` — keystore password
  - `ANDROID_KEY_ALIAS` — key alias (e.g. `asterial`)
  - `ANDROID_KEY_PASSWORD` — key password
- **Optional Vercel Env Var for Verified Android App Links:**
  - `ANDROID_ASSETLINKS_SHA256` — colon-separated SHA-256 certificate fingerprint(s) served dynamically at `https://asterial.vercel.app/.well-known/assetlinks.json`.
- **Fallback Behavior:** If `ANDROID_KEYSTORE_*` secrets are not yet configured, CI builds a standard Android debug-signed installable APK (`asterial-android-1.2.0.apk`), verifies its signature via `apksigner`, uploads it with `.sha256` + `.manifest.json` artifacts, and **explicitly labels it as debug-signed** in the job summary and release notes.

---

## 5. Security, Privacy & Transparency

- **Transport & Database Authorization:** All traffic uses HTTPS/TLS and WSS. Every exposed `public` table enforces PostgreSQL 17 Row Level Security (RLS), and attachments use private signed URLs.
- **Honest Cryptography Disclosure:** Client-side end-to-end encryption (E2EE) is **not** enabled in v1.2; messages are stored in access-controlled Supabase PostgreSQL protected by strict RLS policies.
- **Notifications:** Foreground real-time toasts, sound cues, and standard Web Notification API alerts are supported while ASTERIAL is open. Background FCM push delivery is intentionally not claimed unless Firebase Cloud Messaging credentials are configured.

---

**ASTERIAL v1.2.0** · Official Developer: **Ritam Das** · **By X Huracan**
