// Конфиг только для статического анализа безопасности (этап 2).
// Лежит в test/, прод-конфиг проекта (eslint.config.js) не затрагивается.
// Запуск из корня проекта:
//   npx eslint --config test/eslint.security.config.mjs backend src
import security from "eslint-plugin-security";
import globals from "globals";

const securityRules = { ...security.configs.recommended.rules };

export default [
  {
    files: ["backend/**/*.js"],
    plugins: { security },
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: globals.node,
    },
    rules: securityRules,
  },
  {
    files: ["src/**/*.{js,jsx}"],
    plugins: { security },
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      ecmaFeatures: { jsx: true },
      globals: globals.browser,
    },
    rules: securityRules,
  },
];
