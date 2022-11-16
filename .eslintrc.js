module.exports = {
  plugins: ['@typescript-eslint/eslint-plugin'],
  root: true,
  env: {
    node: true
  },
  extends: [
    'plugin:vue/vue3-essential',
    'eslint:recommended',
    '@vue/typescript/recommended',
    'plugin:prettier/recommended'
  ],
  parserOptions: {
    ecmaVersion: 2020
  },
  rules: {
    'no-console': process.env.NODE_ENV === 'production' ? 'warn' : 'off',
    'no-debugger': process.env.NODE_ENV === 'production' ? 'warn' : 'off',
    '@typescript-eslint/no-unused-vars': 'error',
    'max-len': ['error', { code: 150, ignoreStrings: true }],
    '@typescript-eslint/ban-types': 'off',
    'vue/multi-word-component-names': 'off',
    indent: ['error', 2],
    'prettier/prettier': 'off'
  }
};
