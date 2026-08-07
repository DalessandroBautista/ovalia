import { describe, expect, it } from 'vitest';
import { createSeededRng } from './rng';
import { createCareer, FALLBACK_CATALOG } from './create';
import type { CareerCatalog } from './types';

const catalog: CareerCatalog = {
  clubs: [
    {
      slug: 'club-bajo',
      name: 'Club Bajo',
      level: 4,
      badgeUrl: null,
      unionSlug: 'urba',
      unionName: 'Unión de Rugby de Buenos Aires',
      divisionSlug: 'urba-primera-c',
      divisionName: 'Primera C',
    },
    {
      slug: 'club-medio',
      name: 'Club Medio',
      level: 2,
      badgeUrl: null,
      unionSlug: 'urba',
      unionName: 'Unión de Rugby de Buenos Aires',
      divisionSlug: 'urba-primera-a',
      divisionName: 'Primera A',
    },
    {
      slug: 'club-alto',
      name: 'Club Alto',
      level: 1,
      badgeUrl: null,
      unionSlug: 'urba',
      unionName: 'Unión de Rugby de Buenos Aires',
      divisionSlug: 'urba-top-14',
      divisionName: 'Top 14',
    },
  ],
};

describe('createCareer', () => {
  it('arranca con 18 años, amateur y sin historial', () => {
    const state = createCareer(
      { surname: 'Pérez', position: 'apertura', clubSlug: 'club-bajo', catalog },
      createSeededRng(1),
    );
    expect(state.age).toBe(18);
    expect(state.pro).toBe(false);
    expect(state.retired).toBe(false);
    expect(state.history).toEqual([]);
    expect(state.club.slug).toBe('club-bajo');
  });

  it('es determinística: la misma semilla produce el mismo estado', () => {
    const input = { surname: 'Pérez', position: 'apertura' as const, clubSlug: 'club-bajo', catalog };
    const a = createCareer(input, createSeededRng(77));
    const b = createCareer(input, createSeededRng(77));
    expect(a).toEqual(b);
  });

  it('usa el catálogo de reserva cuando el recibido está vacío', () => {
    const state = createCareer(
      { surname: 'Pérez', position: 'pilar', clubSlug: 'inexistente', catalog: { clubs: [] } },
      createSeededRng(3),
    );
    expect(FALLBACK_CATALOG.clubs.length).toBeGreaterThan(0);
    expect(FALLBACK_CATALOG.clubs.some((c) => c.slug === state.club.slug)).toBe(true);
  });

  it('cae en un club del catálogo cuando el pedido no existe', () => {
    const state = createCareer(
      { surname: 'Pérez', position: 'wing', clubSlug: 'no-existe', catalog },
      createSeededRng(5),
    );
    expect(catalog.clubs.some((c) => c.slug === state.club.slug)).toBe(true);
  });

  it('recorta el apellido y rechaza el vacío usando un valor por defecto', () => {
    const state = createCareer(
      { surname: '   ', position: 'wing', clubSlug: 'club-bajo', catalog },
      createSeededRng(9),
    );
    expect(state.surname.length).toBeGreaterThan(0);
  });

  it('reparte atributos dentro del rango permitido', () => {
    const state = createCareer(
      { surname: 'Pérez', position: 'octavo', clubSlug: 'club-bajo', catalog },
      createSeededRng(11),
    );
    for (const value of Object.values(state.attributes)) {
      expect(value).toBeGreaterThanOrEqual(1);
      expect(value).toBeLessThanOrEqual(10);
    }
  });
});
