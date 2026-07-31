import pluginJs from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

/**
 * @type {import('eslint').Linter.Config[]}
 */
export default [
  {
    languageOptions: {
      globals: globals.nodeBuiltin,
      parserOptions: {
        projectService: true,
      },
    },
  },
  pluginJs.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": "warn",
      "prefer-const": "warn",
      "@typescript-eslint/no-floating-promises": [
        "error",
        {
          allowForKnownSafeCalls: [
            {
              from: "package",
              name: ["it", "describe"],
              package: "node:test",
            },
          ],
        },
      ],
    },
  },
];
