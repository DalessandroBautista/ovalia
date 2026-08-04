import { describe, expect, it } from 'vitest';
import { resolveCountryForOrganization } from './index';

describe('resolveCountryForOrganization', () => {
  it('resuelve un league con countryCode FR a Francia (countryCode tiene prioridad)', () => {
    const country = resolveCountryForOrganization({ countryCode: 'FR', kind: 'league' });
    expect(country.code).toBe('FR');
    expect(country.kind).toBe('country');
  });

  it('resuelve un league sin countryCode a internacional', () => {
    const country = resolveCountryForOrganization({ countryCode: null, kind: 'league' });
    expect(country.code).toBe('international');
  });

  it('resuelve un league con countryCode desconocido a internacional', () => {
    const country = resolveCountryForOrganization({ countryCode: 'XX', kind: 'league' });
    expect(country.code).toBe('international');
  });

  it('resuelve una union con countryCode AR a Argentina', () => {
    const country = resolveCountryForOrganization({ countryCode: 'AR', kind: 'union' });
    expect(country.code).toBe('AR');
    expect(country.kind).toBe('country');
  });

  it('resuelve sevens a internacional', () => {
    const country = resolveCountryForOrganization({ countryCode: null, kind: 'sevens' });
    expect(country.code).toBe('international');
  });
});
