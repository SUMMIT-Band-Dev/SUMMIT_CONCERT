import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    // Build output from other toolchains (e.g. Vite bundles)
    "dist/**",
    "next-env.d.ts",
    // Claude Code 훅 스크립트 — 앱 코드가 아닌 독립 Node CLI 스크립트
    ".claude/hooks/**",
  ]),
]);

export default eslintConfig;
