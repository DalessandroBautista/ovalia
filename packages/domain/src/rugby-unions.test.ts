import { describe, expect, it } from 'vitest';
import * as domain from './index';

type RugbyUnion = {
  slug: string;
  name: string;
  kind: 'union';
  countryCode: 'AR';
};

function argentinaRugbyUnions(): RugbyUnion[] {
  return (domain as typeof domain & { ARGENTINA_RUGBY_UNIONS?: RugbyUnion[] })
    .ARGENTINA_RUGBY_UNIONS ?? [];
}

describe('ARGENTINA_RUGBY_UNIONS', () => {
  it('contiene las 25 uniones miembros de la UAR', () => {
    expect(argentinaRugbyUnions()).toHaveLength(25);
  });

  it('usa un slug único para cada unión', () => {
    const slugs = argentinaRugbyUnions().map((union) => union.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('incluye las uniones necesarias para el catálogo federal y el Regional del Litoral', () => {
    expect(argentinaRugbyUnions().map((union) => union.slug)).toEqual(expect.arrayContaining([
      'urba',
      'cordoba',
      'rosario',
      'santa-fe',
      'entrerriana',
    ]));
  });

  it('declara todas las entradas como uniones argentinas', () => {
    expect(argentinaRugbyUnions().every((union) => union.kind === 'union' && union.countryCode === 'AR')).toBe(true);
  });
});
