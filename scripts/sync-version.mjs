#!/usr/bin/env node
/**
 * Synchronizes and validates centralized ASTERIAL release metadata across
 * version.json, root package.json & package-lock.json, packages/core/package.json,
 * mobile/package.json & mobile/package-lock.json, and mobile/android/app/build.gradle.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

const versionPath = path.join(rootDir, "version.json");
const versionMeta = JSON.parse(fs.readFileSync(versionPath, "utf8"));

if (!/^\d+\.\d+\.\d+$/.test(versionMeta.version)) {
  throw new Error(`Invalid semver in version.json: ${versionMeta.version}`);
}
if (versionMeta.displayVersion !== versionMeta.version) {
  throw new Error(
    `displayVersion (${versionMeta.displayVersion}) must match version (${versionMeta.version}) so all product surfaces display the exact release version.`
  );
}
if (!Number.isInteger(versionMeta.versionCode) || versionMeta.versionCode < 1) {
  throw new Error(
    `Invalid Android versionCode in version.json: ${versionMeta.versionCode}`
  );
}

const checkOnly = process.argv.includes("--check");

const packageTargets = [
  path.join(rootDir, "package.json"),
  path.join(rootDir, "packages", "core", "package.json"),
  path.join(rootDir, "mobile", "package.json"),
];

for (const pkgPath of packageTargets) {
  if (!fs.existsSync(pkgPath)) continue;
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
  let changed = false;

  if (pkg.version !== versionMeta.version) {
    if (checkOnly) {
      throw new Error(
        `Version mismatch in ${path.relative(rootDir, pkgPath)}: ${pkg.version} !== ${versionMeta.version}`
      );
    }
    pkg.version = versionMeta.version;
    changed = true;
  }

  if (
    pkgPath === path.join(rootDir, "package.json") &&
    typeof pkg.description === "string"
  ) {
    const nextDesc = pkg.description.replace(
      /^ASTERIAL v[0-9.]+/,
      `ASTERIAL v${versionMeta.version}`
    );
    if (nextDesc !== pkg.description) {
      if (checkOnly) {
        throw new Error(
          `Description version mismatch in package.json: ${pkg.description}`
        );
      }
      pkg.description = nextDesc;
      changed = true;
    }
  }

  if (changed) {
    fs.writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`, "utf8");
    console.log(
      `Updated ${path.relative(rootDir, pkgPath)} -> ${versionMeta.version}`
    );
  }
}

const lockTargets = [
  path.join(rootDir, "package-lock.json"),
  path.join(rootDir, "mobile", "package-lock.json"),
];

for (const lockPath of lockTargets) {
  if (!fs.existsSync(lockPath)) continue;
  const lock = JSON.parse(fs.readFileSync(lockPath, "utf8"));
  const rootPkgEntry = lock.packages && lock.packages[""];
  const needsUpdate =
    lock.version !== versionMeta.version ||
    (rootPkgEntry && rootPkgEntry.version !== versionMeta.version);

  if (needsUpdate) {
    if (checkOnly) {
      throw new Error(
        `Lockfile version mismatch in ${path.relative(rootDir, lockPath)}: ${lock.version} !== ${versionMeta.version}`
      );
    }
    lock.version = versionMeta.version;
    if (rootPkgEntry) {
      rootPkgEntry.version = versionMeta.version;
    }
    fs.writeFileSync(lockPath, `${JSON.stringify(lock, null, 2)}\n`, "utf8");
    console.log(
      `Updated ${path.relative(rootDir, lockPath)} -> ${versionMeta.version}`
    );
  }
}

const gradlePath = path.join(
  rootDir,
  "mobile",
  "android",
  "app",
  "build.gradle"
);
if (fs.existsSync(gradlePath)) {
  const gradleRaw = fs.readFileSync(gradlePath, "utf8");
  const expectedFallback = `[version: "${versionMeta.version}", versionCode: ${versionMeta.versionCode}]`;
  const updatedGradle = gradleRaw.replace(
    /\[version:\s*"[^"]+",\s*versionCode:\s*\d+\]/,
    expectedFallback
  );
  if (updatedGradle !== gradleRaw) {
    if (checkOnly) {
      throw new Error(
        `Android Gradle fallback version mismatch in mobile/android/app/build.gradle (expected ${expectedFallback})`
      );
    }
    fs.writeFileSync(gradlePath, updatedGradle, "utf8");
    console.log(
      `Updated mobile/android/app/build.gradle -> ${expectedFallback}`
    );
  }
}

console.log(
  `Version check OK: ${versionMeta.name} v${versionMeta.version} (versionCode ${versionMeta.versionCode})`
);
