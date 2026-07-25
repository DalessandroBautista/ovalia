import { describe, expect, it } from 'vitest';
import {
  localWallClockToUtc,
  mapMatchStatus,
  matchTablePoints,
  naturalMatchKey,
  normalizeName,
  parseOffsetDateTime,
  resolveEntity,
  type EntityLookups,
} from './index';

// Tabla de aliases de prueba (equivalente a la que provendría de la DB).
const ALIAS_TABLE: Record<string, string[]> = {};
const EXTERNAL_TABLE: Record<string, string> = {};
function registerAlias(ovaliaId: string, names: string[]) {
  for (const name of names) {
    const key = normalizeName(name);
    ALIAS_TABLE[key] = [...(ALIAS_TABLE[key] ?? []), ovaliaId];
  }
}
registerAlias('team-hindu', ['Hindú', 'Hindu', 'Hindú Club']);
registerAlias('team-casi', ['CASI', 'Club Atlético de San Isidro']);
registerAlias('team-cuba', ['CUBA', 'Club Universitario de Buenos Aires']);
registerAlias('team-nz', ['New Zealand', 'Nueva Zelanda', 'All Blacks']);
registerAlias('team-sa', ['South Africa', 'Sudáfrica', 'Springboks']);
// Dos equipos que comparten un alias corto → ambigüedad deliberada.
registerAlias('team-old-a', ['San Isidro']);
registerAlias('team-old-b', ['San Isidro']);
EXTERNAL_TABLE['urba:11'] = 'team-hindu';

const lookups: EntityLookups = {
  byExternalId: (id) => EXTERNAL_TABLE[id] ?? null,
  byAlias: (norm) => ALIAS_TABLE[norm] ?? [],
};

describe('normalizeName', () => {
  it('iguala variantes con y sin tilde', () => {
    expect(normalizeName('Hindú')).toBe(normalizeName('Hindu'));
    expect(normalizeName('Sudáfrica')).toBe(normalizeName('sudafrica'));
  });
});

describe('resolveEntity', () => {
  it('resuelve por external ID cuando existe', () => {
    const out = resolveEntity({ externalId: 'urba:11', name: 'lo que sea' }, lookups);
    expect(out).toEqual({ kind: 'valid', value: { ovaliaId: 'team-hindu' } });
  });

  it('resuelve Hindú/Hindu por alias normalizado', () => {
    expect(resolveEntity({ externalId: 'x', name: 'Hindu' }, lookups)).toMatchObject({
      kind: 'valid',
      value: { ovaliaId: 'team-hindu' },
    });
  });

  it('resuelve CASI y CUBA por nombre completo o sigla', () => {
    expect(resolveEntity({ externalId: 'x', name: 'Club Atlético de San Isidro' }, lookups)).toMatchObject({
      value: { ovaliaId: 'team-casi' },
    });
    expect(resolveEntity({ externalId: 'x', name: 'CUBA' }, lookups)).toMatchObject({
      value: { ovaliaId: 'team-cuba' },
    });
  });

  it('resuelve nombres multilingües (NZ / Sudáfrica)', () => {
    expect(resolveEntity({ externalId: 'x', name: 'New Zealand' }, lookups)).toMatchObject({
      value: { ovaliaId: 'team-nz' },
    });
    expect(resolveEntity({ externalId: 'x', name: 'Sudáfrica' }, lookups)).toMatchObject({
      value: { ovaliaId: 'team-sa' },
    });
  });

  it('marca conflicto ante alias ambiguo, nunca elige por similitud', () => {
    const out = resolveEntity({ externalId: 'x', name: 'San Isidro' }, lookups);
    expect(out.kind).toBe('conflict');
  });

  it('pone en cuarentena una entidad sin coincidencias', () => {
    const out = resolveEntity({ externalId: 'x', name: 'Equipo Inexistente' }, lookups);
    expect(out.kind).toBe('quarantined');
  });
});

describe('naturalMatchKey', () => {
  it('es estable ante cambios de sede/horario (misma ronda y rivales)', () => {
    const a = naturalMatchKey({ seasonYear: 2026, round: 'Fecha 12', homeKey: 'sic', awayKey: 'hindu' });
    const b = naturalMatchKey({ seasonYear: 2026, round: 'FECHA 12', homeKey: 'sic', awayKey: 'hindu' });
    expect(a).toBe(b);
  });

  it('cambia si cambian los rivales', () => {
    const a = naturalMatchKey({ seasonYear: 2026, round: 'Fecha 12', homeKey: 'sic', awayKey: 'hindu' });
    const b = naturalMatchKey({ seasonYear: 2026, round: 'Fecha 12', homeKey: 'sic', awayKey: 'casi' });
    expect(a).not.toBe(b);
  });
});

describe('dates', () => {
  it('parsea ISO con offset a UTC', () => {
    expect(parseOffsetDateTime('2026-08-01T15:00:00-03:00').toISOString()).toBe(
      '2026-08-01T18:00:00.000Z',
    );
  });

  it('convierte hora local con offset fijo a UTC', () => {
    expect(localWallClockToUtc('2026-08-01T15:00', -180).toISOString()).toBe(
      '2026-08-01T18:00:00.000Z',
    );
  });
});

describe('match status y puntos', () => {
  it('mapea estados válidos y rechaza desconocidos', () => {
    expect(mapMatchStatus('FINAL')).toBe('final');
    expect(() => mapMatchStatus('suspended')).toThrow();
  });

  it('otorga bonus ofensivo y defensivo con la regla del dominio', () => {
    const points = matchTablePoints({ homeScore: 30, awayScore: 27, homeTries: 4, awayTries: 4 });
    expect(points.home).toBe(5); // ganó + bonus 4 tries
    expect(points.away).toBe(2); // perdió por <=7 + bonus 4 tries
  });
});
