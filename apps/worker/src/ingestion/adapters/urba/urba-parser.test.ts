import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  parseClubsAsTeams,
  parseCompetitions,
  parseFixtures,
  parseStandings,
} from './urba-parser';

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), '__fixtures__');
function loadFixture(name: string): unknown {
  return JSON.parse(readFileSync(join(FIXTURES, name), 'utf8'));
}

describe('URBA parser (contract)', () => {
  it('parsea competencias con género y temporada', () => {
    const competitions = parseCompetitions(loadFixture('championships.sample.json'));
    expect(competitions.length).toBeGreaterThanOrEqual(8);
    const top14 = competitions.find((c) => c.externalId === '2025176');
    expect(top14?.name).toContain('TOP 14');
    expect(top14?.season.year).toBe(2026);
    const femenino = competitions.find((c) => /FEMENINO/i.test(c.name));
    expect(femenino?.gender).toBe('female');
  });

  it('filtra por IDs prioritarios', () => {
    const competitions = parseCompetitions(loadFixture('championships.sample.json'), [2025176]);
    expect(competitions).toHaveLength(1);
    expect(competitions[0]!.externalId).toBe('2025176');
  });

  it('emite el slug canónico provisto por el adaptador', () => {
    const slugMap = new Map([['2025176', 'urba-top-14']]);
    const competitions = parseCompetitions(loadFixture('championships.sample.json'), [2025176], slugMap);
    expect(competitions[0]!.slug).toBe('urba-top-14');
  });

  it('parsea familySlug y tier derivados del nombre', () => {
    const competitions = parseCompetitions(loadFixture('championships.sample.json'));
    const top14 = competitions.find((c) => c.externalId === '2025176');
    expect(top14).toMatchObject({ familySlug: 'top-14', tier: 'senior' });
  });

  it('sin filtro de IDs devuelve todas las competencias del fixture', () => {
    const competitions = parseCompetitions(loadFixture('championships.sample.json'));
    expect(competitions.length).toBe(8);
  });

  it('parsea clubes como equipos con escudo y external ID de club', () => {
    const teams = parseClubsAsTeams({
      clubs: [{ id: 1, name: 'SIC', image_uri: 'img/clubs/sic.png' }],
    });
    expect(teams[0]).toMatchObject({
      externalId: '1',
      name: 'SIC',
      countryCode: 'AR',
      union: 'URBA',
      badgeUrl: 'https://api.urba.org.ar/img/clubs/sic.png',
      badgeSourceUrl: 'https://api.urba.org.ar/img/clubs/sic.png',
      badgeFormat: 'png',
    });
  });

  it('no emite campos de badge cuando el club no trae image_uri', () => {
    const teams = parseClubsAsTeams({
      clubs: [{ id: 2, name: 'Sin Logo', image_uri: '' }],
    });
    expect(teams[0]!.badgeUrl).toBeUndefined();
    expect(teams[0]!.badgeSourceUrl).toBeUndefined();
    expect(teams[0]!.badgeFormat).toBeUndefined();
  });

  it('parsea fixtures: fecha AR→UTC, estado y equipos por club', () => {
    const matches = parseFixtures(loadFixture('championship-detail.sample.json'));
    expect(matches.length).toBeGreaterThan(0);
    const final = matches.find((m) => m.status === 'final');
    expect(final).toBeDefined();
    expect(final!.homeTeamExternalId).toMatch(/^\d+$/);
    // Un partido no jugado programado y uno suspendido, generados en el fixture.
    expect(matches.some((m) => m.status === 'scheduled')).toBe(true);
    expect(matches.some((m) => m.status === 'postponed')).toBe(true);
  });

  it('senior con playdate 00:00 → 15:30 local (-03:00) = 18:30Z', () => {
    const matches = parseFixtures(loadFixture('championship-detail.sample.json'));
    // El fixture es "TOP 14 - Superior" (senior) con playdates 00:00:00.
    const midnight = matches.find((m) => m.externalId === '2023134558');
    expect(midnight).toBeDefined();
    expect(midnight!.startsAt).toBe('2026-03-14T18:30:00.000Z');
  });

  it('intermedia con playdate 00:00 → startsAt null', () => {
    const team = (id: number, name: string) => ({ id, name, club: { id, name } });
    const raw = {
      championship: [{
        id: 2025180,
        name: 'PRIMERA A - Intermedia',
        season: { id: 2026, name: '2026' },
        rounds: [{
          id: 1,
          name: 'Fecha 1',
          matches: [
            {
              id: 10,
              playdate: '2026-04-11T00:00:00',
              fulfilled: false,
              suspended: false,
              local_team_score: 0,
              visit_team_score: 0,
              local_team: team(74, 'Almafuerte'),
              visit_team: team(89, 'Berisso'),
            },
          ],
        }],
      }],
    };

    const [match] = parseFixtures(raw);
    expect(match).toBeDefined();
    expect(match!.startsAt).toBeNull();
  });

  it('respeta un horario real (15:30) sin reescribirlo', () => {
    const matches = parseFixtures(loadFixture('championship-detail.sample.json'));
    const kickoff = matches.find((m) => m.externalId === '999001');
    expect(kickoff).toBeDefined();
    expect(kickoff!.startsAt).toBe('2026-09-01T18:30:00.000Z');
  });

  it('omite las fechas libres representadas por el club Bye', () => {
    const team = (id: number, name: string) => ({ id: id * 10, name, club: { id, name } });
    const raw = {
      championship: [{
        id: 2025181,
        name: 'TERCERA - Superior',
        season: { id: 2026, name: '2026' },
        rounds: [{
          id: 1,
          name: 'Fecha 1',
          matches: [
            {
              id: 10,
              playdate: '2026-04-11T00:00:00',
              fulfilled: true,
              suspended: false,
              local_team_score: 0,
              visit_team_score: 0,
              local_team: team(92, 'Bye'),
              visit_team: team(76, 'Ciudad de Campana'),
            },
            {
              id: 11,
              playdate: '2026-04-11T00:00:00',
              fulfilled: true,
              suspended: false,
              local_team_score: 20,
              visit_team_score: 10,
              local_team: team(74, 'Almafuerte'),
              visit_team: team(89, 'Berisso'),
            },
          ],
        }],
      }],
    };

    expect(parseFixtures(raw).map((match) => match.externalId)).toEqual(['11']);
  });

  it('parsea posiciones con puntos oficiales y bonus combinado', () => {
    const standings = parseStandings(loadFixture('positions.sample.json'), '2025176', 2026);
    expect(standings.competitionExternalId).toBe('2025176');
    expect(standings.rows).toHaveLength(5);
    const leader = standings.rows[0]!;
    expect(leader.position).toBe(1);
    expect(leader.points).toBeGreaterThan(0);
    expect(leader.bonus).toBeGreaterThanOrEqual(0);
    expect(leader.teamExternalId).toMatch(/^\d+$/);
  });

  it('falla explícitamente ante una respuesta rota', () => {
    expect(() => parseCompetitions(loadFixture('broken.sample.json'))).toThrow();
    expect(() => parseFixtures(loadFixture('broken.sample.json'))).toThrow();
    expect(() => parseStandings(loadFixture('broken.sample.json'), '1', 2026)).toThrow();
  });
});
