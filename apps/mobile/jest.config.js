/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: {
        jsx: 'react-jsx',
        module: 'commonjs',
        moduleResolution: 'node',
        esModuleInterop: true,
        allowJs: true,
      },
    }],
  },
  setupFiles: ['./src/tests/setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@rv-trax/shared$': '<rootDir>/../../packages/shared/dist/index.js',
    '^@env$': '<rootDir>/src/tests/__mocks__/env.ts',
  },
  transformIgnorePatterns: [
    'node_modules/(?!(react-native-mmkv|zustand|ky)/)',
  ],
  testMatch: ['<rootDir>/src/**/__tests__/**/*.test.{ts,tsx}'],
};
