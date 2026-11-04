// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', '.expo/*', 'node_modules/*'],
  },
  {
    rules: {
      // Quotes and apostrophes in <Text> are fine in React Native; this rule is for HTML
      'react/no-unescaped-entities': 'off',
    },
  },
  {
    files: ['__tests__/**/*.ts'],
    languageOptions: { globals: { describe: 'readonly', it: 'readonly', expect: 'readonly', jest: 'readonly' } },
  },
]);
