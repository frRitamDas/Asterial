import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "mobile/node_modules/**",
    "mobile/android/**",
    "mobile/babel.config.js",
    "mobile/metro.config.js",
    "mobile/index.js",
    "mobile/src/config/runtimeEnv.generated.ts",
  ]),
]);

export default eslintConfig;
