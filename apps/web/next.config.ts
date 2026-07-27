import type { NextConfig } from 'next';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

const nextConfig: NextConfig = {
  reactStrictMode: true,
  turbopack: { root: workspaceRoot },
  // next build valida tipos (además del task explícito de Turbo en el gate).
  typescript: { ignoreBuildErrors: false },
  transpilePackages: ['@ovalia/domain', '@ovalia/i18n', '@ovalia/ui'],
};

export default nextConfig;
