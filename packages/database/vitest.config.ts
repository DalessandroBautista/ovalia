import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    testTimeout: 30_000,
    hookTimeout: 30_000,
    // Los tests comparten una única base de datos efímera y truncan entre casos:
    // deshabilitamos el paralelismo de archivos para evitar interferencias.
    fileParallelism: false,
  },
});
