import nextEslintPluginNext from '@next/eslint-plugin-next';
import nx from '@nx/eslint-plugin';
import prettierConfig from 'eslint-config-prettier';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import baseConfig from '../../eslint.config.mjs';

export default [
  // ── Inherited workspace rules (NX module boundaries, TypeScript) ──
  ...baseConfig,

  // ── NX React + TypeScript rules ──────────────────────────────────
  ...nx.configs['flat/react-typescript'],

  // ── Next.js specific rules ────────────────────────────────────────
  {
    plugins: { '@next/next': nextEslintPluginNext },
    rules: {
      ...nextEslintPluginNext.configs.recommended.rules,
      ...nextEslintPluginNext.configs['core-web-vitals'].rules,
    },
  },

  // ── React Hooks rules (no hooks in loops/conditions) ──────────────
  {
    plugins: { 'react-hooks': reactHooksPlugin },
    rules: reactHooksPlugin.configs.recommended.rules,
  },

  // ── Accessibility rules ───────────────────────────────────────────
  {
    plugins: { 'jsx-a11y': jsxA11y },
    rules: jsxA11y.configs.recommended.rules,
  },

  // ── Project-level overrides ───────────────────────────────────────
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      // Enforce consistent import style
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
      // Warn on unused vars but allow leading underscore to suppress
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    },
  },

  // ── Prettier must be LAST - disables all formatting rules ─────────
  // (so ESLint and Prettier never fight over the same style decisions)
  prettierConfig,

  // ── Ignored paths ────────────────────────────────────────────────
  {
    ignores: ['.next/**/*', 'node_modules/**/*'],
  },
];
