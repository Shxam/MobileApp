/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  testMatch: ['**/*.spec.ts', '**/*.test.ts'],
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', { tsconfig: 'tsconfig.json' }],
    '^.+\\.(js|jsx)$': ['ts-jest', { tsconfig: 'tsconfig.json' }],
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  transformIgnorePatterns: ['node_modules/(?!(jose|jwks-rsa|firebase-admin)/)'],
  // Creates/drops the isolated `ipl_test_e2e` Postgres schema. The suite shares
  // one Neon instance with development, so this is what keeps `public` safe.
  globalSetup: '<rootDir>/test/jest.global-setup.ts',
  globalTeardown: '<rootDir>/test/jest.global-teardown.ts',
  // Runs in every worker process — re-points DATABASE_URL at the test schema
  // and hard-aborts if it resolves anywhere else.
  setupFiles: ['<rootDir>/test/jest.setup.ts'],
  testTimeout: 60000,
  maxWorkers: 1,
};
