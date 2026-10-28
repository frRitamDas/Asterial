# ASTERIAL — Repeatable Release & Android APK Procedure

- **Product:** ASTERIAL (`com.xhuracan.asterial`)
- **Current Release:** `1.3.0` (`versionCode: 13000`)
- **Official Developer:** Ritam Das · **Attribution:** By X Huracan
- **Workflow:** [`.github/workflows/android-release.yml`](../.github/workflows/android-release.yml)

---

## 1. How Build & Release Modes Work

`.github/workflows/android-release.yml` enforces strict separation between validation builds, ordinary branch CI builds, and official semantic-version releases:

| Trigger | Build Mode | Signing Secrets Used? | Creates GitHub Release? | Output |
| :--- | :--- | :--- | :--- | :--- |
| `pull_request` -> `main` | `pr-validation` | Never | Never | Runs full Web/Core/Mobile checks, compiles standalone Hermes APK, verifies signature & bytecode, uploads CI artifact |
| `push` -> `main` or `arena/**` | `ci-build` | Optional (`ANDROID_KEYSTORE_*`) | Never | Runs full checks, compiles & verifies standalone APK, uploads CI artifact (`asterial-android-<semver>`) |
| `push` -> tag `vMAJOR.MINOR.PATCH` | `official-release` | Uses `ANDROID_KEYSTORE_*` when configured; otherwise builds & explicitly labels debug-signed APK | **Yes** (fails if tag mismatches `version.json` or if release already exists) | Publishes official GitHub Release with verified `.apk`, `.apk.sha256`, `.manifest.json`, and release notes |

---

## 2. Step-by-Step Procedure for Publishing `v1.3.0` (and Future `v1.3.1`, `v1.4.0`, etc.)

### Step 1: Bump Centralized Metadata (for future versions after `1.3.0`)
Edit [`version.json`](../version.json):
1. Increment `"version"` and `"displayVersion"` to the exact canonical semver (e.g. `"1.3.1"` or `"1.4.0"`).
2. Increment `"versionCode"` monotonically (e.g. `13100` or `14000`; CI adds `github.run_number` so every build has a strictly higher Android `versionCode`).
3. Update `"releaseDate"` and `"releaseNotes"`.
4. Synchronize and verify all packages, lockfiles, and Gradle fallbacks:
   ```bash
   npm run version:sync
   npm run version:check
   ```

### Step 2: Merge via Pull Request into `main`
Open a Pull Request targeting `main`, ensure **Verify Multi-Product Suite & Compile Standalone APK** and Vercel Preview both succeed, and merge into `main`.

### Step 3: Cut and Push the Canonical Semantic Version Tag on `main`
Never reuse an existing tag or overwrite an existing release. Pull the merged `main` commit and push the exact `vX.Y.Z` tag:

```bash
git checkout main
git pull origin main
npm run version:check

# Create annotated tag matching version.json (e.g. v1.3.0)
git tag -a v1.3.0 -m "ASTERIAL v1.3.0"
git push origin v1.3.0
```

### Step 4: Automatic Verification & Publication
Pushing `v1.3.0` automatically triggers `.github/workflows/android-release.yml` on that exact tagged commit:
1. Confirms `v1.3.0` matches `version.json` (`"1.3.0"`) and confirms no `v1.3.0` GitHub Release already exists.
2. Runs `npm run version:check`, `npm run typecheck`, `npm run mobile:typecheck`, `npm run lint`, `npm test`, `npm run mobile:test`, and `npm run build`.
3. Compiles the standalone React Native `0.83.10` APK via Gradle.
4. Verifies `assets/index.android.bundle` inside the APK carries the Hermes bytecode header (`c61fbc03c103191f`) and verifies the APK signature via `apksigner verify --verbose`.
5. Computes `.sha256` and publishes the official GitHub Release (`https://github.com/frRitamDas/Asterial/releases/tag/v1.3.0`).
6. `/api/release`, `/download`, and in-app update checks automatically detect and serve the verified `v1.3.0` APK and SHA-256 checksum link within 60–120 seconds.

---

## 3. Configuring Production Android Keystore Signing (Optional / Recommended)

To sign official release APKs (`asterial-android-<version>.apk`) with your own persistent Android release keystore instead of CI debug signing (`asterial-android-<version>-debug.apk`):

1. Generate a private release keystore locally (**outside** the Git repository — never commit `*.jks` or `*.keystore` files):
   ```bash
   keytool -genkeypair -v \
     -storetype PKCS12 \
     -keystore ~/asterial-release.jks \
     -alias asterial \
     -keyalg RSA -keysize 4096 -validity 10000
   ```
2. Base64-encode the keystore and add these 4 **Repository Secrets** in GitHub (`Settings -> Secrets and variables -> Actions -> Secrets`):
   - `ANDROID_KEYSTORE_BASE64`: output of `base64 -w 0 ~/asterial-release.jks`
   - `ANDROID_KEYSTORE_PASSWORD`: keystore password
   - `ANDROID_KEY_ALIAS`: `asterial`
   - `ANDROID_KEY_PASSWORD`: key password
3. Optional: add these 2 public **Repository Variables** (`Settings -> Secrets and variables -> Actions -> Variables`) so CI bakes Supabase public config directly at compile time (in addition to `/api/mobile-config` runtime bootstrap):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Optional: copy your release certificate's SHA-256 fingerprint (`keytool -list -v -keystore ~/asterial-release.jks`) into Vercel's `ANDROID_APP_SHA256_CERT_FINGERPRINTS` environment variable so `https://asterial.vercel.app/.well-known/assetlinks.json` enables verified Android App Links.
