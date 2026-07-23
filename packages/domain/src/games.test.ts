import { describe, expect, it } from 'vitest';
import { calculateRugbyIdentity, chooseCareerOutcome } from './games';

describe('Ovalia games', () => {
  it('maps answers to a rugby identity', () => {
    expect(calculateRugbyIdentity([1, 1, -1, 1, 0])).toMatchObject({ profile: 'Estratega', axis: 'territorio' });
  });

  it('maps career decisions to a playing role', () => {
    expect(chooseCareerOutcome({ power: 4, speed: 5, vision: 8 })).toBe('Apertura conductor');
    expect(chooseCareerOutcome({ power: 9, speed: 4, vision: 5 })).toBe('Tercera línea de impacto');
  });
});
