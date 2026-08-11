/**
 * Two projects, because the suite has two genuinely different runtimes.
 *
 * Before this, the config was a single `testEnvironment: 'node'` block whose
 * `testMatch` listed only `*.spec.ts` / `*.test.ts` — `.tsx` matched nothing, so
 * a component test could be written and would simply never run. Adding `.tsx` to
 * that one project would have been worse than useless: every frontend test would
 * have inherited `globalSetup`, spun up the isolated Postgres schema, and then
 * failed on the first `document` reference.
 *
 *   backend → node env, real Postgres/Redis, DB isolation via test/jest.*.ts
 *   frontend → jsdom env, no database at all
 *
 * `globalSetup` / `globalTeardown` stay at the top level: Jest runs them once for
 * the whole run rather than per project, and the backend project needs them.
 *
 * @type {import('ts-jest').JestConfigWithTsJest}
 */
module.exports = {
  // Creates/drops the isolated `ipl_test_e2e` Postgres schema. The suite shares
  // one Neon instance with development, so this is what keeps `public` safe.
  globalSetup: '<rootDir>/test/jest.global-setup.ts',
  globalTeardown: '<rootDir>/test/jest.global-teardown.ts',
  testTimeout: 60000,
  maxWorkers: 1,

  projects: [
    {
      displayName: 'backend',
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
      // Runs in every worker process — re-points DATABASE_URL at the test schema
      // and hard-aborts if it resolves anywhere else.
      setupFiles: ['<rootDir>/test/jest.setup.ts'],
      testTimeout: 60000,
    },
    {
      displayName: 'frontend',
      preset: 'ts-jest',
      testEnvironment: 'jsdom',
      moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
      // `.tsx` only. A `.spec.ts` under src/ is still a node test and belongs to
      // the backend project above; splitting on extension is what keeps a single
      // file from being collected twice.
      testMatch: ['**/*.spec.tsx', '**/*.test.tsx'],
      testPathIgnorePatterns: ['/node_modules/', '/dist/', '/apps/backend/'],
      transform: {
        // ts-jest wrapped so Vite's `import.meta.env` is rewritten to
        // `process.env` before TypeScript sees it — CommonJS output cannot carry
        // `import.meta`, and apiClient.ts reads it at the top level. See the
        // transformer for why the shim is an object rather than `process.env`.
        '^.+\\.(ts|tsx)$': '<rootDir>/test/vite-env-transform.cjs',
      },
      moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/$1',
        // Vite resolves these; Jest would try to parse them as JavaScript and
        // throw on the first selector.
        '\\.(css|less|scss|sass)$': '<rootDir>/test/style-mock.cjs',
        '\\.(png|jpe?g|gif|svg|webp|avif|woff2?)$': '<rootDir>/test/file-mock.cjs',
      },
      // Deliberately NOT test/jest.setup.ts — that opens the database. The
      // frontend setup only installs jest-dom matchers and the browser APIs
      // jsdom omits.
      setupFilesAfterEnv: ['<rootDir>/test/jest.setup.dom.ts'],
      testTimeout: 15000,
    },
  ],
};
