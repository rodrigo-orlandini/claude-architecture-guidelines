module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: 'tsconfig.json',
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint'],
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
  env: { node: true, es2022: true, jest: true },
  ignorePatterns: ['dist', 'coverage', 'node_modules'],
  rules: {
    'no-console': ['error', { allow: ['error'] }],
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/consistent-type-imports': 'error',
    // Nest decorators (@Injectable, @Controller...) rely on the class being
    // referenced only by its side effects at the metadata level.
    '@typescript-eslint/no-extraneous-class': 'off',
  },
}
