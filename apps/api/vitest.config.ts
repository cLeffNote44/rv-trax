import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    root: './src',
    include: ['tests/**/*.test.ts'],
    testTimeout: 30000,
    hookTimeout: 30000,
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    env: {
      DATABASE_URL: 'postgresql://rvtrax:rvtrax_dev@localhost:5432/rvtrax_test',
      REDIS_URL: 'redis://localhost:6379/1',
      JWT_SECRET: 'test-jwt-secret-that-is-at-least-64-characters-long-for-security-padding',
      COOKIE_SECRET: 'test-cookie-secret',
      NODE_ENV: 'test',
      API_HOST: '0.0.0.0',
      API_PORT: '0',
      ADMIN_TOKEN: 'test-admin-token',
      ADMIN_API_TOKEN: 'test-admin-token',
    },
  },
});
