import { randomUUID } from 'node:crypto';
import { access, mkdir, rename, rm, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { normalizeTeamName } from '@ovalia/domain';
import { z } from 'zod';

export interface BadgeFileStore {
  exists(path: string): Promise<boolean>;
  writeAtomic(path: string, content: Uint8Array): Promise<void>;
}

export interface SyncTeamBadgeOptions {
  sourceUrl: string;
  destination: string;
  force?: boolean;
  fetcher: typeof globalThis.fetch;
  store: BadgeFileStore;
  maxBytes?: number;
  timeoutMs?: number;
}

export function createNodeBadgeFileStore(): BadgeFileStore {
  return {
    async exists(path) {
      try {
        await access(path);
        return true;
      } catch {
        return false;
      }
    },
    async writeAtomic(path, content) {
      await mkdir(dirname(path), { recursive: true });
      const temporaryPath = `${path}.${process.pid}.${randomUUID()}.tmp`;
      try {
        await writeFile(temporaryPath, content);
        await rename(temporaryPath, path);
      } catch (error) {
        await rm(temporaryPath, { force: true });
        throw error;
      }
    },
  };
}

const ALLOWED_CONTENT_TYPES = new Set(['image/png', 'image/webp', 'image/svg+xml']);

const providerTeamSchema = z.object({
  id: z.number(),
  name: z.string(),
  logo: z.string().url(),
});

const providerTeamsSchema = z.union([
  z.object({ data: z.array(providerTeamSchema) }).transform((payload) => payload.data),
  z.array(providerTeamSchema),
]);

export async function findHighlightlyTeam(options: {
  apiKey: string;
  query: string;
  acceptedNames: readonly string[];
  fetcher?: typeof globalThis.fetch;
  baseUrl?: string;
}) {
  const fetcher = options.fetcher ?? globalThis.fetch;
  const query = new URLSearchParams({ name: options.query });
  const response = await fetcher(`${options.baseUrl ?? 'https://rugby.highlightly.net'}/teams?${query}`, {
    headers: { 'x-rapidapi-key': options.apiKey },
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new Error(`Highlightly team lookup failed with ${response.status}`);
  const teams = providerTeamsSchema.parse(await response.json());
  const accepted = new Set(options.acceptedNames.map(normalizeTeamName));
  return teams.find((team) => accepted.has(normalizeTeamName(team.name)));
}

export async function syncTeamBadgeAsset(options: SyncTeamBadgeOptions) {
  if (!options.force && await options.store.exists(options.destination)) {
    return { status: 'unchanged' as const };
  }

  const maxBytes = options.maxBytes ?? 2_000_000;
  const response = await options.fetcher(options.sourceUrl, {
    headers: { 'user-agent': 'Ovalia/0.1 team-badge-sync (local development)' },
    signal: AbortSignal.timeout(options.timeoutMs ?? 8_000),
  });
  if (!response.ok) {
    throw new Error(`Team badge request failed with ${response.status}`);
  }

  const contentType = response.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase() ?? '';
  if (!ALLOWED_CONTENT_TYPES.has(contentType)) {
    throw new Error(`Unsupported team badge content type: ${contentType || 'missing'}`);
  }

  const announcedBytes = Number(response.headers.get('content-length'));
  if (Number.isFinite(announcedBytes) && announcedBytes > maxBytes) {
    throw new Error(`Team badge exceeds ${maxBytes} bytes`);
  }

  const content = new Uint8Array(await response.arrayBuffer());
  if (content.byteLength > maxBytes) {
    throw new Error(`Team badge exceeds ${maxBytes} bytes`);
  }
  await options.store.writeAtomic(options.destination, content);
  return { status: 'downloaded' as const, bytes: content.byteLength, contentType };
}
