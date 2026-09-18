import js from '@eslint/js'
import globals from 'globals'

export default [
  {
    ignores: [
      'dist/**',
      'docs/**',
      'node_modules/**',
      'storybook-static/**',
      'coverage/**',
      'playwright-report/**',
      'packages/*/dist/**',
      'packages/*/src/**', // framework wrappers (jsx/vue/svelte) — not linted here
    ],
  },
  js.configs.recommended,
  {
    files: ['src/**/*.js', 'scripts/**/*.{js,mjs}', '*.config.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      eqeqeq: ['error', 'always', { null: 'ignore' }],
    },
  },
  {
    files: ['src/worker/**/*.js'],
    languageOptions: {
      globals: { ...globals.worker },
    },
  },
  {
    files: ['stories/**/*.js', '.storybook/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['tests/**/*.js', 'scripts/*.spec.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
]
