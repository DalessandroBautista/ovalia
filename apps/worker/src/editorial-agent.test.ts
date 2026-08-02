import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { enqueueJob } from '@ovalia/database';
import { getTestDatabase, isDatabaseAvailable, truncateAll } from '@ovalia/database/test-support';
import { generateAndStoreMatchDraft, generateMatchDraft } from './editorial-agent';
import { runEditorialWorkerOnce } from './editorial-worker';

describe('editorial agent', () => {
  it('creates a reviewable draft and never publishes it', async () => {
    const client = {
      responses: {
        create: async () => ({
          output_text: JSON.stringify({
            title: 'Los Pumas lo dieron vuelta en el cierre',
            summary: 'Argentina se impuso por tres puntos.',
            body: 'Una reacción en el segundo tiempo cambió el partido.',
            tags: ['Los Pumas', 'Rugby Championship']
          })
        })
      }
    };

    const draft = await generateMatchDraft(client, {
      competition: 'Rugby Championship',
      homeTeam: 'Argentina',
      awayTeam: 'Sudáfrica',
      homeScore: 24,
      awayScore: 21,
      events: []
    });

    expect(draft.status).toBe('review');
    expect(draft.aiGenerated).toBe(true);
    expect(draft.title).toContain('Los Pumas');
  });
});

const available = await isDatabaseAvailable();

describe.skipIf(!available)('editorial agent persistence', () => {
  let handle: Awaited<ReturnType<typeof getTestDatabase>>;

  beforeEach(async () => {
    handle = await getTestDatabase();
    await truncateAll(handle);
  });

  afterAll(async () => {
    if (available) await handle.pool.end().catch(() => undefined);
  });

  it('guarda el resultado de IA como review y conserva los datos fuente', async () => {
    const client = {
      responses: {
        create: async () => ({
          output_text: JSON.stringify({
            title: 'Crónica del partido',
            summary: 'Resumen verificable del encuentro.',
            body: 'La nota usa únicamente los datos recibidos del partido.',
            tags: ['rugby'],
          }),
        }),
      },
    };
    const stored = await generateAndStoreMatchDraft(handle.db, client, {
      slug: 'cronica-del-partido',
      match: {
        competition: 'URBA', homeTeam: 'A', awayTeam: 'B', homeScore: 20, awayScore: 10, events: [],
      },
    });

    expect(stored.status).toBe('review');
    expect(stored.aiGenerated).toBe(true);
    expect(stored.sourceData).toEqual(expect.objectContaining({ homeTeam: 'A' }));
  });

  it('consume un job editorial, persiste el borrador y lo marca como done', async () => {
    const client = {
      responses: {
        create: async () => ({
          output_text: JSON.stringify({
            title: 'Nota generada desde la cola',
            summary: 'Resumen generado con datos verificados.',
            body: 'Cuerpo generado para revisión humana antes de publicar.',
            tags: [],
          }),
        }),
      },
    };
    await enqueueJob(handle.db, {
      type: 'editorial.match-draft',
      dedupeKey: 'editorial:test-match',
      payload: {
        slug: 'nota-desde-cola',
        match: { competition: 'URBA', homeTeam: 'A', awayTeam: 'B', homeScore: 20, awayScore: 10, events: [] },
      },
    });
    expect(await runEditorialWorkerOnce(handle.db, client, 'test-worker')).toBe(true);

    expect((await handle.db.query.jobs.findFirst())?.status).toBe('done');
    expect((await handle.db.query.articles.findFirst())?.status).toBe('review');
  });
});
