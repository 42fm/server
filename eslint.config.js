import pluginJs from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

/**
 * @type {import('eslint').Linter.FlatConfig[]}
 */
export default [
  { languageOptions: { globals: globals.nodeBuiltin } },
  pluginJs.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": "warn",
    },
  },
];
