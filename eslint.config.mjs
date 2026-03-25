import js from '@eslint/js'
import globals from 'globals'

export default [
  {
    ignores: ['dist/**', 'app/**', 'config/**', 'agent.js', 'app.js'],
  },
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2025,
      sourceType: 'module',
      globals: {
        ...globals.node,
      },
    },
    rules: {
      'no-console': 'off',
      'no-unused-vars': 'off',
      'no-shadow': 'off',
      'no-param-reassign': 'off',
      camelcase: 'off',
      'no-bitwise': 'off',
      semi: ['warn', 'never'],
      quotes: ['warn', 'single', { avoidEscape: true, allowTemplateLiterals: true }],
      indent: ['warn', 2],
      'no-empty': ['warn', { allowEmptyCatch: true }],
      'prefer-const': 'off',
      'no-var': 'error',
      'no-constant-condition': ['warn', { checkLoops: false }],
    },
  },
]
