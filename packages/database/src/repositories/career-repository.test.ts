import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import type { DatabaseHandle } from '../client.js';
import { makeTeam } from '../test-support/index.js';
import { getTestDatabase, isDatabaseAvailable, truncateAll } from '../test-support/index.js';
import { createUser } from './users-repository.js';
import { countRecentEntriesByOrigin, findCareerEntryById, insertCareerEntry, listCareerEntries } from './career-repository.js';

const available = await isDatabaseAvailable();

describe.skipIf(!available)('career_entries', () => {
  let handle: DatabaseHandle;

  beforeEach(async () => {
    handle = await getTestDatabase();
    await truncateAll(handle);
  });

  afterAll(async () => {
    if (available) await handle.pool.end().catch(() => undefined);
  });

  const entry = {
    score: 850,
    displayName: 'TercerTiempo',
    summary: {
      tier: 'Gloria amateur',
      verdict: 'Una vida de rugby amateur.',
      score: 850,
      comparison: { figure: 'Hugo Porta', reason: 'Tu carrera se parece a la de Hugo Porta.' },
      seasons: 14,
      clubs: ['Bajo'],
      peakLevel: 4,
    },
    history: [{ season: 1, age: 18, clubSlug: 'bajo', clubName: 'Bajo', level: 4, rating: 62, note: 'Temporada sólida.' }],
    surname: 'Pérez',
    position: 'centro',
    clubSlug: 'bajo',
    seed: 42,
    decisions: [0, 1, 0],
    originKey: 'abc123',
  };

  it('inserta y recupera una entrada por id', async () => {
    const { db } = handle;
    const created = await insertCareerEntry(db, entry);
    const found = await findCareerEntryById(db, created.id);
    expect(found).not.toBeNull();
    expect(found!.displayName).toBe('TercerTiempo');
    expect(found!.score).toBe(850);
    expect(found!.seed).toBe(42);
    expect(found!.decisions).toEqual([0, 1, 0]);
  });

  it('lista las entradas ordenadas por puntaje descendente', async () => {
    const { db } = handle;
    await insertCareerEntry(db, { ...entry, score: 500, displayName: 'Bajo' });
    await insertCareerEntry(db, { ...entry, score: 900, displayName: 'Alto' });
    const rows = await listCareerEntries(db, { limit: 10 });
    expect(rows.map((r) => r.displayName)).toEqual(['Alto', 'Bajo']);
  });

  it('cuenta las publicaciones recientes por origen para el límite de frecuencia', async () => {
    const { db } = handle;
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    await insertCareerEntry(db, { ...entry, originKey: 'mismo-origen' });
    await insertCareerEntry(db, { ...entry, originKey: 'mismo-origen', displayName: 'Otro' });
    await insertCareerEntry(db, { ...entry, originKey: 'otro-origen' });
    expect(await countRecentEntriesByOrigin(db, 'mismo-origen', since)).toBe(2);
    expect(await countRecentEntriesByOrigin(db, 'otro-origen', since)).toBe(1);
  });

  it('acepta userId y guarda el nombre del usuario como displayName', async () => {
    const { db } = handle;
    const user = await createUser(db, { email: 'jugador@mail.com', displayName: 'Jugador de Varela' });
    const created = await insertCareerEntry(db, { ...entry, displayName: 'Jugador de Varela', userId: user.id });
    expect(created.userId).toBe(user.id);
  });
});
