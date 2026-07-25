import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createNodeBadgeFileStore, findHighlightlyTeam, syncTeamBadgeAsset, type BadgeFileStore } from './team-badge-sync';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

function memoryStore(initial: string[] = []) {
  const files = new Map<string, Uint8Array>(initial.map((path) => [path, new Uint8Array([1])]));
  const store: BadgeFileStore = {
    exists: async (path) => files.has(path),
    writeAtomic: async (path, content) => { files.set(path, content); },
  };
  return { files, store };
}

describe('team badge synchronizer', () => {
  it('writes files atomically while creating their directory', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'ovalia-badges-'));
    temporaryDirectories.push(directory);
    const destination = join(directory, 'nested', 'sic.png');
    const store = createNodeBadgeFileStore();

    await store.writeAtomic(destination, new Uint8Array([1, 2, 3]));

    await expect(store.exists(destination)).resolves.toBe(true);
    await expect(readFile(destination)).resolves.toEqual(Buffer.from([1, 2, 3]));
  });

  it('selects the provider team matching a canonical name or alias', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({
      data: [
        { id: 10, name: 'Argentina U20', logo: 'https://img.example/arg-u20.png' },
        { id: 11, name: 'Argentina', logo: 'https://img.example/arg.png' },
      ],
    }), { status: 200, headers: { 'content-type': 'application/json' } }));

    await expect(findHighlightlyTeam({
      apiKey: 'secret',
      query: 'Argentina',
      acceptedNames: ['Argentina', 'Los Pumas'],
      fetcher,
    })).resolves.toEqual({ id: 11, name: 'Argentina', logo: 'https://img.example/arg.png' });
  });

  it('downloads an allowed image into the requested destination', async () => {
    const { files, store } = memoryStore();
    const fetcher = vi.fn(async () => new Response(new Uint8Array([137, 80, 78, 71]), {
      status: 200,
      headers: { 'content-type': 'image/png', 'content-length': '4' },
    }));

    const result = await syncTeamBadgeAsset({
      sourceUrl: 'https://img.example/sic.png',
      destination: '/badges/sic.png',
      fetcher,
      store,
    });

    expect(result).toEqual({ status: 'downloaded', bytes: 4, contentType: 'image/png' });
    expect(files.get('/badges/sic.png')).toEqual(new Uint8Array([137, 80, 78, 71]));
    expect(fetcher).toHaveBeenCalledWith('https://img.example/sic.png', expect.objectContaining({
      headers: expect.objectContaining({ 'user-agent': expect.stringContaining('Ovalia') }),
    }));
  });

  it('does not request an asset that already exists', async () => {
    const { store } = memoryStore(['/badges/sic.png']);
    const fetcher = vi.fn();

    await expect(syncTeamBadgeAsset({
      sourceUrl: 'https://img.example/sic.png',
      destination: '/badges/sic.png',
      fetcher,
      store,
    })).resolves.toEqual({ status: 'unchanged' });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('rejects unsupported content without replacing an existing file', async () => {
    const { files, store } = memoryStore(['/badges/sic.png']);
    const previous = files.get('/badges/sic.png');

    await expect(syncTeamBadgeAsset({
      sourceUrl: 'https://img.example/sic.gif',
      destination: '/badges/sic.png',
      force: true,
      fetcher: async () => new Response('not an allowed image', { status: 200, headers: { 'content-type': 'image/gif' } }),
      store,
    })).rejects.toThrow('Unsupported team badge content type');
    expect(files.get('/badges/sic.png')).toBe(previous);
  });
});
