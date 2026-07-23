import type { NextConfig } from 'next';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

const nextConfig: NextConfig = {
  reactStrictMode: true,
  turbopack: { root: workspaceRoot },
  // Type checking runs as an explicit Turbo task before builds in CI/local verification.
  typescript: { ignoreBuildErrors: true },
  transpilePackages: ['@ovalia/domain', '@ovalia/i18n', '@ovalia/ui'],
};

export default nextConfig;
