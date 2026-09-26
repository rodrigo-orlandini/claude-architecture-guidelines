import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

// Unit + integration juntos com coverage combinado (job "coverage" do CI). Threshold global 80%.
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['reflect-metadata'],
    include: ['src/**/*.spec.ts', 'src/**/*.integration-spec.ts'],
    hookTimeout: 30000,
    testTimeout: 30000,
    pool: 'forks',
    poolOptions: {
      forks: { singleFork: true },
    },
    env: {
      DATABASE_URL: process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5433/{{project_db}}_test',
      REDIS_URL: process.env.REDIS_URL ?? 'redis://localhost:6380',
    },
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.spec.ts',
        'src/**/*.integration-spec.ts',
        'src/**/*.d.ts',
        'src/**/container.ts',
        'src/main.ts',
        'src/infra/http/server.ts',
        'src/modules/*/infra/http/**',
        'src/modules/*/dtos/**',
        'src/modules/*/repositories/**',
        'src/shared/database/**',
        'src/shared/observability/**',
        'src/shared/types/**',
        'src/shared/core/use-case.ts',
      ],
      thresholds: {
        branches: 80,
        functions: 80,
        lines: 80,
        statements: 80,
      },
    },
  },
  resolve: {
    alias: {
      '@shared': resolve(__dirname, 'src/shared'),
      '@modules': resolve(__dirname, 'src/modules'),
      '@infra': resolve(__dirname, 'src/infra'),
    },
  },
})
