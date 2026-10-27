#!/usr/bin/env node
/**
 * Synchronizes and validates centralized ASTERIAL release metadata across
 * version.json, package.json, and Android build configuration.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

const versionPath = path.join(rootDir, "version.json");
const packagePath = path.join(rootDir, "package.json");

const versionMeta = JSON.parse(fs.readFileSync(versionPath, "utf8"));
const pkg = JSON.parse(fs.readFileSync(packagePath, "utf8"));

if (!/^\d+\.\d+\.\d+$/.test(versionMeta.version)) {
  throw new Error(`Invalid semver in version.json: ${versionMeta.version}`);
}
if (!Number.isInteger(versionMeta.versionCode) || versionMeta.versionCode < 1) {
  throw new Error(
    `Invalid Android versionCode in version.json: ${versionMeta.versionCode}`
  );
}

const checkOnly = process.argv.includes("--check");

if (pkg.version !== versionMeta.version) {
  if (checkOnly) {
    throw new Error(
      `Version mismatch: package.json (${pkg.version}) !== version.json (${versionMeta.version})`
    );
  }
  pkg.version = versionMeta.version;
  pkg.description = `${versionMeta.name} v${versionMeta.displayVersion} — Precision real-time messaging across Web & Android. Official Developer: ${versionMeta.developer} | ${versionMeta.attribution}.`;
  fs.writeFileSync(packagePath, `${JSON.stringify(pkg, null, 2)}\n`, "utf8");
  console.log(`Updated package.json version -> ${versionMeta.version}`);
} else {
  console.log(
    `Version check OK: ${versionMeta.name} v${versionMeta.version} (versionCode ${versionMeta.versionCode})`
  );
}
