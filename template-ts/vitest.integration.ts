import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

// Integration: Postgres/Redis reais de docker-compose.test.yml. Serial (singleFork) para não disputar o banco.
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['reflect-metadata'],
    include: ['src/**/*.integration-spec.ts'],
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
  },
  resolve: {
    alias: {
      '@shared': resolve(__dirname, 'src/shared'),
      '@modules': resolve(__dirname, 'src/modules'),
      '@infra': resolve(__dirname, 'src/infra'),
    },
  },
})
