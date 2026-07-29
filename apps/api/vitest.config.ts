import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    testTimeout: 30_000,
    hookTimeout: 30_000,
    fileParallelism: false,
    // Base de test propia: evita interferencia con otros paquetes bajo turbo.
    env: { TEST_DATABASE_NAME: 'ovalia_test_api' },
  },
});
