import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const repositoryRoot = resolve(import.meta.dirname, '../../..');

function readPackage(relativePath: string) {
  return JSON.parse(
    readFileSync(resolve(repositoryRoot, relativePath, 'package.json'), 'utf8'),
  ) as {
    exports?: Record<string, string | Record<string, string>>;
    scripts?: Record<string, string>;
  };
}

describe('workspace packages used by the deployed API', () => {
  it.each(['packages/domain', 'packages/database'])(
    '%s exposes compiled JavaScript to Node at runtime',
    (packagePath) => {
      const packageJson = readPackage(packagePath);
      const rootExport = packageJson.exports?.['.'];

      expect(rootExport).toMatchObject({
        types: './src/index.ts',
        default: './dist/index.js',
      });
    },
  );

  it('builds runtime workspace dependencies before Vercel packages the API', () => {
    const packageJson = readPackage('apps/api');

    expect(packageJson.scripts?.['vercel-build']).toContain('@ovalia/domain build');
    expect(packageJson.scripts?.['vercel-build']).toContain('@ovalia/database build');
  });

  it('uses Node-compatible extensions for relative API imports', () => {
    const sourceRoot = resolve(repositoryRoot, 'apps/api/src');
    const sourceFiles = readdirSync(sourceRoot, { recursive: true })
      .filter((path): path is string => typeof path === 'string' && path.endsWith('.ts'))
      .filter((path) => !path.endsWith('.test.ts'));
    const relativeImport = /(?:from|import)\s+['"](\.\.?\/[^'"]+)['"]/g;

    const violations = sourceFiles.flatMap((path) => {
      const source = readFileSync(resolve(sourceRoot, path), 'utf8');
      return [...source.matchAll(relativeImport)]
        .map((match) => match[1])
        .filter((specifier) => !specifier?.endsWith('.js'))
        .map((specifier) => `${path}: ${specifier}`);
    });

    expect(violations).toEqual([]);
  });
});
