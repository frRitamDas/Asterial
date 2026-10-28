#!/usr/bin/env node
/**
 * Synchronizes and validates centralized ASTERIAL release metadata across
 * version.json, root package.json (Web), packages/core/package.json, and
 * mobile/package.json (React Native Android).
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
if (!Number.isInteger(versionMeta.versionCode) || versionMeta.versionCode < 1) {
  throw new Error(
    `Invalid Android versionCode in version.json: ${versionMeta.versionCode}`
  );
}

const checkOnly = process.argv.includes("--check");
const targets = [
  path.join(rootDir, "package.json"),
  path.join(rootDir, "packages", "core", "package.json"),
  path.join(rootDir, "mobile", "package.json"),
];

for (const pkgPath of targets) {
  if (!fs.existsSync(pkgPath)) continue;
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
  if (pkg.version !== versionMeta.version) {
    if (checkOnly) {
      throw new Error(
        `Version mismatch in ${path.relative(rootDir, pkgPath)}: ${pkg.version} !== ${versionMeta.version}`
      );
    }
    pkg.version = versionMeta.version;
    fs.writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`, "utf8");
    console.log(
      `Updated ${path.relative(rootDir, pkgPath)} -> ${versionMeta.version}`
    );
  }
}

console.log(
  `Version check OK: ${versionMeta.name} v${versionMeta.version} (versionCode ${versionMeta.versionCode})`
);
