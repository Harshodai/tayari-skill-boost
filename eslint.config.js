import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  // supabase/functions/**: Deno edge functions, a different runtime/style
  // than the browser src/ tree this config targets. supabase/functions/mcp/
  // index.ts specifically is also a generated bundle ("Bundled from
  // src/lib/mcp/index.ts by @lovable.dev/mcp-js" — see its header comment)
  // with no local regeneration script in this repo; lint it as source and
  // it fails wholesale on bundler-output patterns (var, etc.) that aren't
  // real issues in the hand-written src/ code this config exists to check.
  { ignores: ["dist", "supabase/functions/**"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {"no-console": ["warn", { allow: ["warn", "error"] }],
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
);
