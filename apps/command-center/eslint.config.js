// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  { ignores: ['dist/*', '.expo/*', 'coverage/*', 'site-server/*'] },
  {
    rules: {
      'react/no-danger': 'error',
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'lucide-react-native',
              message:
                "Import icons from '@/components/icons' (per-icon imports keep the web bundle small).",
            },
          ],
          patterns: [
            {
              group: ['@supabase/*'],
              message: 'Only repositories in src/lib/data may talk to Supabase.',
            },
          ],
        },
      ],
      'max-lines': ['error', { max: 200, skipBlankLines: true, skipComments: true }],
    },
  },
  {
    files: ['src/lib/data/**', 'src/components/icons.ts'],
    rules: { 'no-restricted-imports': 'off' },
  },
  {
    // jest.mock factories must use require(); limited to the test setup file.
    files: ['jest.setup.ts'],
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
  {
    // Route files stay thin: compose features, no business logic.
    files: ['src/app/**'],
    rules: { 'max-lines': ['error', { max: 80, skipBlankLines: true, skipComments: true }] },
  },
]);
