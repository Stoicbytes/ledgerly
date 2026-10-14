const preset = require('jest-expo/jest-preset');

// jest-expo's Babel transform, plus import() → require() (see scripts/jest-dynamic-import.js).
const SOURCE = '\\.[jt]sx?$';
const [babelJest, babelOptions] = preset.transform[SOURCE];

/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  transform: {
    ...preset.transform,
    [SOURCE]: [
      babelJest,
      {
        ...babelOptions,
        plugins: [
          ...(babelOptions.plugins ?? []),
          require.resolve('./scripts/jest-dynamic-import.js'),
        ],
      },
    ],
  },
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  // Screen tests render whole sheets; on 2-core CI runners with coverage the
  // first render in a file can pass Jest's 5 s default (seen on the category
  // delete test, which takes under 1 s locally).
  testTimeout: 20000,
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    // lucide ships ESM as .mjs, which Jest does not transform; use its CJS build.
    '^lucide-react-native/icons/(.*)$':
      '<rootDir>/node_modules/lucide-react-native/dist/cjs/icons/$1.js',
  },
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|expo-router|react-navigation|@react-navigation/.*|react-native-svg|lucide-react-native)',
  ],
  // Built copy of the portfolio's server bundle (npm run build:site), not app code.
  modulePathIgnorePatterns: ['<rootDir>/site-server/'],
  collectCoverageFrom: ['src/**/*.{ts,tsx}', '!src/app/**', '!src/**/*.d.ts'],
};
