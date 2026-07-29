import { describe, expect, it } from 'vitest';
import { deriveUrbaTaxonomy } from './urba-taxonomy';

describe('deriveUrbaTaxonomy', () => {
  it('clasifica Superior como senior', () => {
    expect(deriveUrbaTaxonomy('TOP 14 - Superior')).toEqual({ familySlug: 'top-14', tier: 'senior' });
  });
  it('clasifica Intermedia como intermediate', () => {
    expect(deriveUrbaTaxonomy('TOP 14 - Intermedia')).toEqual({ familySlug: 'top-14', tier: 'intermediate' });
  });
  it('clasifica Preintermedia (con o sin letra) como intermediate', () => {
    expect(deriveUrbaTaxonomy('TOP 14 - Preintermedia')).toEqual({ familySlug: 'top-14', tier: 'intermediate' });
    expect(deriveUrbaTaxonomy('TOP 14 - Preintermedia B')).toEqual({ familySlug: 'top-14', tier: 'intermediate' });
  });
  it('clasifica Menores de 22 como youth', () => {
    expect(deriveUrbaTaxonomy('TOP 14 - Menores de 22')).toEqual({ familySlug: 'top-14', tier: 'youth' });
  });
  it('clasifica Femenino como women, familia por su propio nombre', () => {
    expect(deriveUrbaTaxonomy('FEMENINO - TOP 9')).toEqual({ familySlug: 'femenino', tier: 'women' });
  });
  it('clasifica Menores de 19/17/16/15 como youth, familia por edad', () => {
    expect(deriveUrbaTaxonomy('Menores de 19 - Primera Rueda - G2 NIVEL 1 A')).toEqual({ familySlug: 'menores-de-19', tier: 'youth' });
    expect(deriveUrbaTaxonomy('Menores de 15 - Primera Rueda - G1 A')).toEqual({ familySlug: 'menores-de-15', tier: 'youth' });
  });
  it('clasifica Universitario/Formativo como university', () => {
    expect(deriveUrbaTaxonomy('Rugby Universitario - Campeonato')).toEqual({ familySlug: 'rugby-universitario', tier: 'university' });
    expect(deriveUrbaTaxonomy('Rugby Formativo - Primera Division')).toEqual({ familySlug: 'rugby-formativo', tier: 'university' });
  });
  it('nombres sin patrón conocido devuelven senior y familia propia, sin crashear', () => {
    expect(deriveUrbaTaxonomy('Torneo Especial')).toEqual({ familySlug: 'torneo-especial', tier: 'senior' });
  });
});
