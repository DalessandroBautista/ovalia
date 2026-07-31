import { describe, expect, it } from 'vitest';
import { calculateRugbyIdentity, chooseCareerOutcome, roleToCareerPosition } from './games';

describe('Ovalia games', () => {
  it('maps answers to a rugby identity', () => {
    expect(calculateRugbyIdentity([1, 1, -1, 1, 0])).toMatchObject({ profile: 'Estratega', axis: 'territorio' });
  });

  it('maps career decisions to a playing role', () => {
    expect(chooseCareerOutcome({ power: 4, speed: 5, vision: 8 })).toBe('Apertura conductor');
    expect(chooseCareerOutcome({ power: 9, speed: 4, vision: 5 })).toBe('Tercera línea de impacto');
  });
});

describe('roleToCareerPosition', () => {
  it('mapea los cuatro roles de Camino al XV a posiciones del motor', () => {
    expect(roleToCareerPosition('Tercera línea de impacto')).toBe('ala');
    expect(roleToCareerPosition('Wing definidor')).toBe('wing');
    expect(roleToCareerPosition('Apertura conductor')).toBe('apertura');
    expect(roleToCareerPosition('Centro completo')).toBe('centro');
  });

  it('devuelve null para cualquier otro rol', () => {
    expect(roleToCareerPosition('Kicker')).toBeNull();
    expect(roleToCareerPosition('')).toBeNull();
  });
});
