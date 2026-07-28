import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseMatchesAsFixtures, parseMatchesAsTeams, parseStandingsPayload } from './highlightly-parser';

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), '__fixtures__');
function loadFixture(name: string): unknown {
  return JSON.parse(readFileSync(join(FIXTURES, name), 'utf8'));
}

describe('Highlightly parser (contrato)', () => {
  it('parsea partidos con estado y equipos', () => {
    const matches = parseMatchesAsFixtures(loadFixture('matches-rugby-championship.sample.json'), '73119');
    expect(matches.length).toBeGreaterThan(0);
    const finished = matches.find((m) => m.status === 'final');
    expect(finished).toBeDefined();
    expect(finished!.homeTeamExternalId).toMatch(/^\d+$/);
    expect(finished!.competitionExternalId).toBe('73119');
  });

  it('deriva equipos únicos de los partidos', () => {
    const teams = parseMatchesAsTeams(loadFixture('matches-rugby-championship.sample.json'));
    expect(teams.length).toBeGreaterThan(0);
    expect(new Set(teams.map((t) => t.externalId)).size).toBe(teams.length);
  });

  it('devuelve rows vacío sin lanzar cuando standings no tiene groups', () => {
    const standings = parseStandingsPayload(loadFixture('standings-empty.sample.json'), '73119', 2025);
    expect(standings.rows).toEqual([]);
  });
});
