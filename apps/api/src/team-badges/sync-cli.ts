import { loadEnvFile } from 'node:process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { TEAM_BADGES } from '@ovalia/domain';
import { createNodeBadgeFileStore, findHighlightlyTeam, syncTeamBadgeAsset } from './team-badge-sync.js';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
try {
  loadEnvFile(resolve(repositoryRoot, '.env'));
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
}

const apiKey = process.env.HIGHLIGHTLY_API_KEY?.trim();
const baseUrl = process.env.HIGHLIGHTLY_API_BASE_URL ?? 'https://rugby.highlightly.net';
const force = process.argv.includes('--force');
const store = createNodeBadgeFileStore();
const manifest: Array<Record<string, unknown>> = [];
let downloaded = 0;
let unchanged = 0;

for (const team of TEAM_BADGES) {
  try {
    const providerTeam = !team.sourceUrl && apiKey && team.providerQuery
      ? await findHighlightlyTeam({
          apiKey,
          baseUrl,
          query: team.providerQuery,
          acceptedNames: [team.name, team.shortCode, ...team.aliases],
        })
      : undefined;
    const sourceUrl = providerTeam?.logo ?? team.sourceUrl;
    if (!sourceUrl) {
      manifest.push({ slug: team.slug, name: team.name, badgePath: team.badgePath, status: 'missing' });
      console.warn(`○ ${team.name}: no se encontró un activo verificable`);
      continue;
    }

    const destination = resolve(repositoryRoot, 'apps/web/public', team.badgePath.slice(1));
    const result = await syncTeamBadgeAsset({ sourceUrl, destination, force, fetcher: globalThis.fetch, store });
    if (result.status === 'downloaded') downloaded += 1;
    else unchanged += 1;
    manifest.push({
      slug: team.slug,
      name: team.name,
      aliases: team.aliases,
      badgePath: team.badgePath,
      sourceUrl,
      highlightlyId: providerTeam?.id,
      status: 'verified',
    });
    console.log(`${result.status === 'downloaded' ? '✓' : '–'} ${team.name}: ${result.status}`);
  } catch (error) {
    manifest.push({
      slug: team.slug,
      name: team.name,
      badgePath: team.badgePath,
      status: 'error',
      error: error instanceof Error ? error.message : String(error),
    });
    console.error(`× ${team.name}: ${error instanceof Error ? error.message : String(error)}`);
  }
  await delay(500);
}

const manifestPath = resolve(repositoryRoot, 'apps/web/public/teams/manifest.json');
await store.writeAtomic(manifestPath, new TextEncoder().encode(`${JSON.stringify({ schemaVersion: 1, teams: manifest }, null, 2)}\n`));

const unresolved = manifest.length - downloaded - unchanged;
console.log(`Escudos: ${downloaded} descargados, ${unchanged} sin cambios, ${unresolved} pendientes.`);
