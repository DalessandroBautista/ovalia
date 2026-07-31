import { describe, expect, it } from 'vitest';
import { classifyCompetitionTier } from './competition-tier.js';

describe('classifyCompetitionTier', () => {
  it('clasifica como juvenil las competencias "Menores de N"', () => {
    expect(classifyCompetitionTier('Menores de 15 - Primera Rueda - G1 A')).toBe('youth');
    expect(classifyCompetitionTier('Menores de 16 - Primera Rueda - G1 A')).toBe('youth');
    expect(classifyCompetitionTier('Menores de 17 - Primera Rueda - G1 A')).toBe('youth');
    expect(classifyCompetitionTier('Menores de 19 - Primera Rueda - G1 A')).toBe('youth');
  });

  it('clasifica como juveniles las abreviaturas habituales M15 a M20', () => {
    expect(classifyCompetitionTier('M15')).toBe('youth');
    expect(classifyCompetitionTier('M16 Torneo Apertura')).toBe('youth');
    expect(classifyCompetitionTier('Torneo M17')).toBe('youth');
    expect(classifyCompetitionTier('M18')).toBe('youth');
    expect(classifyCompetitionTier('M19')).toBe('youth');
    expect(classifyCompetitionTier('M20')).toBe('youth');
  });

  it('es insensible a mayúsculas y acentos', () => {
    expect(classifyCompetitionTier('MENORES DE 16')).toBe('youth');
    expect(classifyCompetitionTier('ménores de 15')).toBe('youth');
    expect(classifyCompetitionTier('m15')).toBe('youth');
  });

  it('no confunde nombres de adultos que contienen números similares', () => {
    expect(classifyCompetitionTier('TOP 14')).toBe('senior');
    expect(classifyCompetitionTier('Primera 15')).toBe('senior');
    expect(classifyCompetitionTier('URBA Top 14')).toBe('senior');
    expect(classifyCompetitionTier('Torneo del Interior A')).toBe('senior');
  });

  it('no confunde abreviaturas fuera de rango o pegadas a otra palabra', () => {
    expect(classifyCompetitionTier('M14')).toBe('senior');
    expect(classifyCompetitionTier('M21')).toBe('senior');
    expect(classifyCompetitionTier('EquipoM15')).toBe('senior');
  });

  it('devuelve senior por defecto para competencias de clubes/uniones sin marca juvenil', () => {
    expect(classifyCompetitionTier('URBA Primera A')).toBe('senior');
    expect(classifyCompetitionTier('Rugby Championship')).toBe('senior');
    expect(classifyCompetitionTier('Seven de la República')).toBe('senior');
  });
});
