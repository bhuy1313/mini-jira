import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Allow function parameters with a leading `_` prefix to be unused.
  // e.g. the permission service accepts `role` for a uniform signature even
  // though some actions ignore it.
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_" },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  // Toast gate: `toast` object của sonner chỉ được gọi từ src/lib/notify.ts
  // (text cố định, không tên động — public-api.spec từng strict-violation
  // vì toast chứa tên). `Toaster` component (layout) và mock trong *.test.*
  // không nằm trong diện gate.
  {
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "sonner",
              importNames: ["toast"],
              message:
                "Import toast helpers from @/lib/notify instead of sonner directly.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["src/lib/notify.ts", "**/*.test.ts", "**/*.test.tsx"],
    rules: {
      "no-restricted-imports": "off",
    },
  },
]);

export default eslintConfig;
