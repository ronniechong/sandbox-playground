// @ts-check
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    files: ['apps/**/*.{ts,tsx}'],
    rules: {
      // Components are copied into each app at scaffold time (see AGENTS.md
      // "Copy over couple") — importing packages/ui at runtime defeats that.
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@exp/ui', '@exp/ui/*', '**/packages/ui/*'],
              message:
                'Copy components from packages/ui at scaffold time instead of importing them.',
            },
          ],
        },
      ],
      'no-restricted-syntax': [
        'warn',
        {
          selector:
            "CallExpression[callee.property.name='addEventListener']:not(:has(Property[key.name='signal']))",
          message:
            'addEventListener in apps/** should pass an AbortSignal so listeners are cleaned up on unmount.',
        },
      ],
    },
  },
  {
    files: ['packages/shell/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'react',
              message: 'packages/shell is vanilla TypeScript — no framework, no React.',
            },
          ],
        },
      ],
    },
  },
  {
    ignores: ['**/dist/**', '**/site/**', 'public/**', '.git-blame-ignore-revs'],
  },
  prettier,
);
