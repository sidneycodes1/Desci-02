/**
 * Shared ESLint base config for the SciAgent monorepo (ESLint 8 eslintrc format).
 *
 * Every workspace extends this instead of duplicating rules:
 *   { "extends": ["@sciagent/eslint-config/base"] }
 *
 * Package-specific rules live in that package's own .eslintrc.json —
 * never copy this file.
 */
module.exports = {
  root: true,
  extends: [
    'next/core-web-vitals',
    'eslint:recommended',
    'plugin:react/recommended',
    'plugin:@typescript-eslint/recommended',
    'prettier',
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    ecmaFeatures: {
      jsx: true,
    },
  },
  env: {
    browser: true,
    es2022: true,
    node: true,
  },
  settings: {
    react: {
      version: 'detect',
    },
  },
  rules: {
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    'react/react-in-jsx-scope': 'off',
    'next/link/href': 'off',
  },
  overrides: [
    {
      files: ['**/*.ts', '**/*.tsx'],
      rules: {
        'no-html-link-for-pages': 'off',
      },
    },
  ],
};
