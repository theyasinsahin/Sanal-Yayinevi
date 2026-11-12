export default [{
  ignores: ['node_modules/**', 'coverage/**', 'dist/**'],
}, {
  files: ['**/*.js'],
  languageOptions: { ecmaVersion: 'latest', sourceType: 'module' },
  rules: {
    'constructor-super': 'error',
    'no-this-before-super': 'error',
    'no-dupe-args': 'error',
    'no-dupe-keys': 'error',
    'no-dupe-class-members': 'error',
    'no-duplicate-case': 'error',
    'no-const-assign': 'error',
    'no-unreachable': 'error',
    'no-unsafe-finally': 'error',
    'no-unsafe-negation': 'error',
    'valid-typeof': 'error',
  },
}];
