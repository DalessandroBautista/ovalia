import { describe, expect, it } from 'vitest';
import { createSeededRng, pickWeighted, randomInt } from './rng';

describe('createSeededRng', () => {
  it('produce siempre la misma secuencia para la misma semilla', () => {
    const a = createSeededRng(12345);
    const b = createSeededRng(12345);
    const seqA = [a.next(), a.next(), a.next()];
    const seqB = [b.next(), b.next(), b.next()];
    expect(seqA).toEqual(seqB);
  });

  it('produce secuencias distintas para semillas distintas', () => {
    const a = createSeededRng(1);
    const b = createSeededRng(2);
    expect(a.next()).not.toBe(b.next());
  });

  it('devuelve valores dentro de [0, 1)', () => {
    const rng = createSeededRng(999);
    for (let i = 0; i < 500; i += 1) {
      const value = rng.next();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
});

describe('randomInt', () => {
  it('respeta los límites inclusive', () => {
    const rng = createSeededRng(7);
    for (let i = 0; i < 200; i += 1) {
      const value = randomInt(rng, 3, 6);
      expect(value).toBeGreaterThanOrEqual(3);
      expect(value).toBeLessThanOrEqual(6);
      expect(Number.isInteger(value)).toBe(true);
    }
  });

  it('devuelve el mismo valor cuando el rango es de uno', () => {
    expect(randomInt(createSeededRng(1), 5, 5)).toBe(5);
  });
});

describe('pickWeighted', () => {
  it('devuelve null con una lista vacía', () => {
    expect(pickWeighted(createSeededRng(1), [])).toBeNull();
  });

  it('nunca elige un elemento de peso cero', () => {
    const rng = createSeededRng(42);
    const items = [
      { weight: 0, value: 'nunca' },
      { weight: 1, value: 'siempre' },
    ];
    for (let i = 0; i < 100; i += 1) {
      expect(pickWeighted(rng, items)).toBe('siempre');
    }
  });

  it('favorece a los elementos de mayor peso', () => {
    const rng = createSeededRng(2024);
    const items = [
      { weight: 9, value: 'frecuente' },
      { weight: 1, value: 'raro' },
    ];
    let frecuente = 0;
    for (let i = 0; i < 1000; i += 1) {
      if (pickWeighted(rng, items) === 'frecuente') frecuente += 1;
    }
    expect(frecuente).toBeGreaterThan(800);
    expect(frecuente).toBeLessThan(980);
  });
});
