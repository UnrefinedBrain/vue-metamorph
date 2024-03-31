const path = require('path');

/** @type {import("eslint").ESLint.ConfigData} */
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    sourceType: 'module',
    ecmaVersion: 2020,
    project: path.join(__dirname, 'tsconfig.eslint.json'),
  },
  plugins: [
    '@typescript-eslint',
  ],

  ignorePatterns: [
    'node_modules',
    'dist',
  ],
  extends: [
    'plugin:@typescript-eslint/recommended',
    'airbnb-base',
    'airbnb-typescript/base',
  ],
  rules: {
    'import/prefer-default-export': 0,
    'no-param-reassign': 0,
    'no-plusplus': 0,
    'no-restricted-syntax': 0,
    'import/extensions': 0,
    'no-await-in-loop': 0,
    'no-continue': 0,
    'max-len': 0,
    '@typescript-eslint/semi': 2,
    '@typescript-eslint/no-loop-func': 0,
    '@typescript-eslint/member-delimiter-style': [2, {
      multiline: {
        delimiter: 'semi',
        requireLast: true,
      },
    }],
  },
  overrides: [
    {
      files: ['*.cjs'],
      rules: {
        '@typescript-eslint/no-var-requires': 0,
      },
    },
    {
      files: ['tsup.config.ts', 'docs/**'],
      rules: {
        'import/no-extraneous-dependencies': 0,
      },
    },
  ],
};
