import { describe, expect, it } from 'vitest';

import { buildHeadToHead, buildRecentForm, findTeamPosition } from './match-context';
import type { PastMatch } from './match-context';

const match = (
  id: string,
  startsAt: string,
  homeTeamSlug: string,
  homeScore: number,
  awayTeamSlug: string,
  awayScore: number,
): PastMatch => ({ id, startsAt, homeTeamSlug, homeScore, awayTeamSlug, awayScore });

describe('buildHeadToHead', () => {
  it('devuelve un balance vacío cuando no hubo enfrentamientos', () => {
    expect(buildHeadToHead({ homeTeamSlug: 'hindu', awayTeamSlug: 'la-plata', matches: [] })).toEqual({
      played: 0,
      homeWins: 0,
      awayWins: 0,
      draws: 0,
      recent: [],
    });
  });

  it('cuenta la victoria del equipo local aunque haya jugado de visitante', () => {
    const matches = [match('m1', '2025-05-10T18:00:00.000Z', 'la-plata', 12, 'hindu', 30)];
    const result = buildHeadToHead({ homeTeamSlug: 'hindu', awayTeamSlug: 'la-plata', matches });
    expect(result.homeWins).toBe(1);
    expect(result.awayWins).toBe(0);
  });

  it('cuenta los empates por separado', () => {
    const matches = [match('m1', '2025-05-10T18:00:00.000Z', 'hindu', 20, 'la-plata', 20)];
    expect(buildHeadToHead({ homeTeamSlug: 'hindu', awayTeamSlug: 'la-plata', matches })).toMatchObject({
      played: 1,
      homeWins: 0,
      awayWins: 0,
      draws: 1,
    });
  });

  it('ignora los partidos contra terceros', () => {
    const matches = [
      match('m1', '2025-05-10T18:00:00.000Z', 'hindu', 20, 'sic', 10),
      match('m2', '2025-06-10T18:00:00.000Z', 'hindu', 20, 'la-plata', 10),
    ];
    expect(buildHeadToHead({ homeTeamSlug: 'hindu', awayTeamSlug: 'la-plata', matches }).played).toBe(1);
  });

  it('lista los más recientes primero y respeta el límite', () => {
    const matches = [
      match('m1', '2024-05-10T18:00:00.000Z', 'hindu', 20, 'la-plata', 10),
      match('m2', '2026-05-10T18:00:00.000Z', 'hindu', 21, 'la-plata', 11),
      match('m3', '2025-05-10T18:00:00.000Z', 'hindu', 22, 'la-plata', 12),
    ];
    const result = buildHeadToHead({ homeTeamSlug: 'hindu', awayTeamSlug: 'la-plata', matches, limit: 2 });
    expect(result.played).toBe(3);
    expect(result.recent.map((item) => item.id)).toEqual(['m2', 'm3']);
  });
});

describe('buildRecentForm', () => {
  it('devuelve una lista vacía sin partidos previos', () => {
    expect(buildRecentForm({ teamSlug: 'hindu', matches: [] })).toEqual([]);
  });

  it('clasifica victoria, empate y derrota desde ambos lados', () => {
    const matches = [
      match('m1', '2026-05-03T18:00:00.000Z', 'hindu', 30, 'sic', 10),
      match('m2', '2026-05-02T18:00:00.000Z', 'sic', 15, 'hindu', 15),
      match('m3', '2026-05-01T18:00:00.000Z', 'sic', 25, 'hindu', 12),
    ];
    expect(buildRecentForm({ teamSlug: 'hindu', matches })).toEqual(['win', 'draw', 'loss']);
  });

  it('devuelve como máximo cinco resultados, del más reciente al más viejo', () => {
    const matches = Array.from({ length: 7 }, (_, index) =>
      match(`m${index}`, `2026-05-0${index + 1}T18:00:00.000Z`, 'hindu', 30, 'sic', 10));
    expect(buildRecentForm({ teamSlug: 'hindu', matches })).toEqual(['win', 'win', 'win', 'win', 'win']);
  });
});

describe('findTeamPosition', () => {
  const rows = [
    { teamSlug: 'hindu', points: 40, played: 10 },
    { teamSlug: 'la-plata', points: 30, played: 10 },
  ];

  it('devuelve el puesto según el orden recibido', () => {
    expect(findTeamPosition(rows, 'la-plata')).toEqual({ position: 2, points: 30, played: 10 });
  });

  it('devuelve null cuando el equipo no está en la tabla', () => {
    expect(findTeamPosition(rows, 'sic')).toBeNull();
  });
});
