# ASTERIAL — Repeatable Release & Android APK Procedure (v1.4.0)

- **Product:** ASTERIAL (`com.xhuracan.asterial`)
- **Current Release:** `1.4.0` (`versionCode: 14000`)
- **Official Developer:** Ritam Das · **Attribution:** By X Huracan
- **Workflow:** [`.github/workflows/android-release.yml`](../.github/workflows/android-release.yml)

---

## 1. How Build & Release Modes Work

`.github/workflows/android-release.yml` enforces strict separation between validation builds, ordinary branch CI builds, and official semantic-version releases:

| Trigger | Build Mode | Signing Secrets Used? | Creates GitHub Release? | Output |
| :--- | :--- | :--- | :--- | :--- |
| `pull_request` -> `main` | `pr-validation` | Never | Never | Runs full Web/Core/Mobile checks, preflights Supabase Auth TLS health, compiles Universal + ABI-split (`arm64-v8a`, `armeabi-v7a`, `x86_64`) Hermes APKs, asserts embedded Supabase host, verifies `apksigner` signatures & `.sha256` checksums, uploads CI artifact |
| `push` -> `main` or `arena/**` | `ci-build` | Optional (`ANDROID_KEYSTORE_*`) | Never | Runs full checks, compiles & verifies Universal + ABI-split APKs, uploads CI artifact (`asterial-android-<semver>`) |
| `push` -> tag `vMAJOR.MINOR.PATCH` | `official-release` | Uses `ANDROID_KEYSTORE_*` when configured; otherwise builds & explicitly labels debug-signed test APKs | **Yes** (fails if tag mismatches `version.json` or if release already exists) | Publishes official GitHub Release with verified Universal + ABI-split `.apk` files, `.apk.sha256` checksums, `.manifest.json`, and release notes |

---

## 2. Publication Gate on `/download`

`/download` and `/api/release` query the live GitHub Releases API (`src/lib/version/githubRelease.ts`) and verify `tagReleasePublished`:
- If `v1.4.0` has not yet been published as a GitHub Release asset, `/download` **never** marks the `v1.4.0` APK as available — instead it transparently notes that `v1.4.0` is pending publication while keeping the latest verified published release asset available.
- Once tag `v1.4.0` completes `.github/workflows/android-release.yml` and publishes its `.apk` + `.sha256` assets, `/download` automatically surfaces the Universal APK and architecture-specific (`arm64-v8a`, `armeabi-v7a`, `x86_64`) downloads within 60 seconds.

---

## 3. Step-by-Step Procedure for Publishing `v1.4.0`

1. Merge the verified `v1.4.0` Pull Request into `main` after GitHub Actions (`Verify Multi-Product Suite & Compile Standalone APKs`) and Vercel Preview succeed.
2. Pull `main` and push the canonical annotated tag matching `version.json`:
   ```bash
   git checkout main
   git pull origin main
   npm run version:check
   git tag -a v1.4.0 -m "ASTERIAL v1.4.0"
   git push origin v1.4.0
   ```
3. `.github/workflows/android-release.yml` automatically builds, verifies (`apksigner verify` + Hermes bytecode check + `.sha256`), and publishes GitHub Release `v1.4.0`.
