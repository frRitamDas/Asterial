#!/usr/bin/env node
/**
 * Generates gitignored mobile/src/config/runtimeEnv.generated.ts from verified
 * public environment variables or root .env.local.
 *
 * SECURITY & RELIABILITY GUARANTEES:
 * 1. Only public client variables (NEXT_PUBLIC_SUPABASE_URL,
 *    NEXT_PUBLIC_SUPABASE_ANON_KEY, NEXT_PUBLIC_APP_URL) are read.
 *    SUPABASE_SERVICE_ROLE_KEY and sb_secret_* keys are strictly rejected.
 * 2. Placeholder hosts (placeholder.supabase.co, localhost, 127.0.0.1, 10.0.2.2)
 *    and placeholder keys (public-anon-placeholder) are stripped to "" so they
 *    can NEVER poison an Android bundle with NXDOMAIN endpoints.
 * 3. --if-missing writes a stub ONLY if runtimeEnv.generated.ts does not exist,
 *    preventing typecheck/lint steps from clobbering an already-prepared config.
 * 4. --require-valid fails with exit code 1 if a real HTTPS Supabase URL and
 *    valid public anon/publishable key are not present (used in release CI).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const dotEnvPath = path.join(rootDir, ".env.local");
const outPath = path.join(
  rootDir,
  "mobile",
  "src",
  "config",
  "runtimeEnv.generated.ts"
);

const args = new Set(process.argv.slice(2));
const onlyIfMissing = args.has("--if-missing");
const requireValid = args.has("--require-valid");

if (onlyIfMissing && fs.existsSync(outPath)) {
  process.exit(0);
}

const DISALLOWED_HOSTS = new Set([
  "placeholder.supabase.co",
  "your-project-ref.supabase.co",
  "example.com",
  "example.supabase.co",
  "localhost",
  "127.0.0.1",
  "10.0.2.2",
  "0.0.0.0",
]);

function isValidPublicUrl(raw) {
  if (!raw || typeof raw !== "string") return false;
  const trimmed = raw.trim();
  if (!trimmed.startsWith("https://")) return false;
  try {
    const parsed = new URL(trimmed);
    const host = parsed.hostname.toLowerCase();
    if (!host || !host.includes(".")) return false;
    if (DISALLOWED_HOSTS.has(host)) return false;
    if (
      host.includes("placeholder") ||
      host.includes("your-project") ||
      host.endsWith(".local") ||
      host.endsWith(".invalid")
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

function isValidPublicAnonKey(raw) {
  if (!raw || typeof raw !== "string") return false;
  const trimmed = raw.trim();
  if (trimmed.length < 24) return false;
  const lower = trimmed.toLowerCase();
  if (
    lower.includes("placeholder") ||
    lower.includes("your-anon-key") ||
    lower.startsWith("sb_secret_")
  ) {
    return false;
  }
  if (trimmed.startsWith("sb_publishable_")) {
    return trimmed.length >= 30;
  }
  const parts = trimmed.split(".");
  if (parts.length === 3 && parts[1]) {
    try {
      const normalized = parts[1].replace(/-/g, "+").replace(/_/g, "/");
      const json = Buffer.from(normalized, "base64").toString("utf8");
      const payload = JSON.parse(json);
      if (payload.role && payload.role !== "anon") {
        throw new Error(
          `SECURITY BLOCK: Refusing to embed non-anon JWT role "${payload.role}" into Android mobile config.`
        );
      }
      return true;
    } catch (err) {
      if (err instanceof Error && err.message.startsWith("SECURITY BLOCK:")) {
        throw err;
      }
      return false;
    }
  }
  return false;
}

function parseDotEnv(filePath) {
  const map = {};
  if (!fs.existsSync(filePath)) return map;
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eqIdx = line.indexOf("=");
    if (eqIdx <= 0) continue;
    const key = line.slice(0, eqIdx).trim();
    const val = line
      .slice(eqIdx + 1)
      .trim()
      .replace(/^['"]|['"]$/g, "");
    map[key] = val;
  }
  return map;
}

function readExistingValidConfig(filePath) {
  if (!fs.existsSync(filePath)) return null;
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    const urlMatch = raw.match(/supabaseUrl:\s*("([^"\\]|\\.)*")/);
    const keyMatch = raw.match(/supabaseAnonKey:\s*("([^"\\]|\\.)*")/);
    const webMatch = raw.match(/appWebUrl:\s*("([^"\\]|\\.)*")/);
    if (!urlMatch || !keyMatch) return null;
    const parsedUrl = JSON.parse(urlMatch[1]);
    const parsedKey = JSON.parse(keyMatch[1]);
    const parsedWeb = webMatch ? JSON.parse(webMatch[1]) : "https://asterial.vercel.app";
    if (isValidPublicUrl(parsedUrl) && isValidPublicAnonKey(parsedKey)) {
      return {
        supabaseUrl: parsedUrl,
        supabaseAnonKey: parsedKey,
        appWebUrl: parsedWeb,
      };
    }
  } catch {
    // ignore parse failure
  }
  return null;
}

const localEnv = parseDotEnv(dotEnvPath);

const candidateUrls = [
  process.env.ASTERIAL_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  localEnv.ASTERIAL_SUPABASE_URL,
  localEnv.NEXT_PUBLIC_SUPABASE_URL,
];

const candidateKeys = [
  process.env.ASTERIAL_SUPABASE_ANON_KEY,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  localEnv.ASTERIAL_SUPABASE_ANON_KEY,
  localEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
];

let resolvedUrl = candidateUrls.find((u) => isValidPublicUrl(u))?.trim() || "";
let resolvedKey =
  candidateKeys.find((k) => isValidPublicAnonKey(k))?.trim() || "";

const rawAppWebUrl = (
  process.env.NEXT_PUBLIC_APP_URL ||
  localEnv.NEXT_PUBLIC_APP_URL ||
  "https://asterial.vercel.app"
).trim();
const resolvedAppWebUrl = isValidPublicUrl(rawAppWebUrl)
  ? rawAppWebUrl.replace(/\/+$/, "")
  : "https://asterial.vercel.app";

// Never clobber an already-valid generated config with empty/placeholder values
if ((!resolvedUrl || !resolvedKey) && !args.has("--force-empty")) {
  const existing = readExistingValidConfig(outPath);
  if (existing) {
    resolvedUrl = existing.supabaseUrl;
    resolvedKey = existing.supabaseAnonKey;
    console.log(
      "Preserved existing verified public Supabase config in runtimeEnv.generated.ts"
    );
  }
}

// In strict / CI builds where public env vars live on Vercel rather than GitHub Actions
// repository variables, fetch verified public client config from /api/mobile-config.
if (
  (!resolvedUrl || !resolvedKey) &&
  !args.has("--force-empty") &&
  (requireValid || args.has("--remote-fallback"))
) {
  try {
    const endpoint = `${resolvedAppWebUrl}/api/mobile-config`;
    const res = await fetch(endpoint, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(10_000),
    });
    if (res.ok) {
      const payload = await res.json();
      if (
        payload &&
        isValidPublicUrl(payload.supabaseUrl) &&
        isValidPublicAnonKey(payload.supabaseAnonKey)
      ) {
        resolvedUrl = payload.supabaseUrl.trim();
        resolvedKey = payload.supabaseAnonKey.trim();
        console.log(
          `Bootstrapped verified public Supabase config from ${endpoint}`
        );
      }
    }
  } catch (err) {
    console.warn(
      `Warning: Remote /api/mobile-config bootstrap unavailable (${
        err instanceof Error ? err.message : String(err)
      })`
    );
  }
}

if (!resolvedUrl || !resolvedKey) {
  resolvedUrl = "";
  resolvedKey = "";
  if (requireValid) {
    console.error(
      "ERROR: Valid public Supabase URL and anon key are required (--require-valid), but none were resolved."
    );
    process.exit(1);
  }
}

fs.mkdirSync(path.dirname(outPath), { recursive: true });
const fileContents = `// AUTO-GENERATED BY scripts/prepare-mobile-env.mjs — DO NOT COMMIT
export const GENERATED_MOBILE_ENV = {
  supabaseUrl: ${JSON.stringify(resolvedUrl.replace(/\/+$/, ""))},
  supabaseAnonKey: ${JSON.stringify(resolvedKey)},
  appWebUrl: ${JSON.stringify(resolvedAppWebUrl)},
} as const;
`;

fs.writeFileSync(outPath, fileContents, "utf8");
const hostPreview = resolvedUrl ? new URL(resolvedUrl).host : "unconfigured (remote-bootstrap)";
console.log(`Prepared mobile runtime config (Supabase endpoint: ${hostPreview})`);
