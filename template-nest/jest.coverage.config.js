// Combined unit + e2e coverage run, used only by `npm run test:coverage` (the
// CI "coverage" job). Mirrors the TS+Fastify sibling's vitest.coverage.ts:
// same idea (merge both suites, enforce one threshold), Jest's own shape.
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testEnvironment: 'node',
  testRegex: '(\\.spec|\\.e2e-spec)\\.ts$',
  roots: ['<rootDir>/src', '<rootDir>/test'],
  transform: { '^.+\\.(t|j)s$': 'ts-jest' },
  setupFiles: ['<rootDir>/test/jest-e2e.setup.ts'],
  moduleNameMapper: {
    '^@shared/(.*)$': '<rootDir>/src/shared/$1',
    '^@modules/(.*)$': '<rootDir>/src/modules/$1',
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.spec.ts',
    '!src/**/*.e2e-spec.ts',
    '!src/main.ts',
    '!src/app.module.ts',
    '!src/**/*.module.ts',
    '!src/shared/database/**',
    '!src/shared/observability/**',
    '!src/modules/*/dtos/**',
    '!src/modules/*/repositories/**',
    '!src/modules/*/infra/http/**',
    '!src/shared/core/use-case.ts',
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
}
