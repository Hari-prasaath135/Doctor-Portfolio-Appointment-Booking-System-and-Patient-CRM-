import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Keep existing any-usage visible as a warning while CI continues
      // to enforce a production build. Reduce this debt incrementally.
      "@typescript-eslint/no-explicit-any": "warn",
      // Existing UI effects are being refactored incrementally; keep these visible
      // as warnings so lint can still report unrelated regressions.
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/preserve-manual-memoization": "warn",
      "react/no-unescaped-entities": "warn",
    },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "dist/**",
    "backend/test/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
