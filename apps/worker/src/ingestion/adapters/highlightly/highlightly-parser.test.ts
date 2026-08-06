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

  it('tolera score null (partido todavía no jugado) sin lanzar', () => {
    const matches = parseMatchesAsFixtures(
      { data: [{ id: 1, date: '2026-08-01T00:00:00.000Z', homeTeam: { id: 1, name: 'A' }, awayTeam: { id: 2, name: 'B' }, league: { id: 1, name: 'X', season: 2026 }, state: { description: 'Not started', score: null } }] },
      '1',
    );
    expect(matches[0]!.homeScore).toBeNull();
    expect(matches[0]!.awayScore).toBeNull();
    expect(matches[0]!.status).toBe('scheduled');
  });

  it('devuelve rows vacío sin lanzar cuando standings no tiene groups', () => {
    const standings = parseStandingsPayload(loadFixture('standings-empty.sample.json'), '73119', 2025);
    expect(standings.rows).toEqual([]);
  });

  it('parsea las filas de standings desde los groups', () => {
    const standings = parseStandingsPayload(loadFixture('standings-groups.sample.json'), '73119', 2026);
    expect(standings.rows).toHaveLength(2);
    const first = standings.rows[0]!;
    expect(first.teamExternalId).toBe('392244');
    expect(first.teamName).toBe('Argentina');
    expect(first.position).toBe(1);
    expect(first.played).toBe(4);
    expect(first.won).toBe(3);
    expect(first.drawn).toBe(0);
    expect(first.lost).toBe(1);
    expect(first.pointsFor).toBe(216);
    expect(first.pointsAgainst).toBe(95);
    expect(first.points).toBe(9);
    expect(standings.competitionExternalId).toBe('73119');
    expect(standings.seasonYear).toBe(2026);
  });
});
