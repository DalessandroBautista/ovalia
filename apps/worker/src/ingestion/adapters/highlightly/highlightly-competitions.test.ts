import { describe, expect, it } from 'vitest';
import { HIGHLIGHTLY_COMPETITIONS, HIGHLIGHTLY_SLUG_BY_EXTERNAL_ID } from './highlightly-competitions';

describe('HIGHLIGHTLY_COMPETITIONS', () => {
  it('no contiene externalId duplicados', () => {
    const externalIds = HIGHLIGHTLY_COMPETITIONS.map((c) => c.externalId);
    const uniqueIds = new Set(externalIds);
    expect(uniqueIds.size).toBe(externalIds.length);
  });

  it('no contiene slugs duplicados', () => {
    const slugs = HIGHLIGHTLY_COMPETITIONS.map((c) => c.slug);
    const uniqueSlugs = new Set(slugs);
    expect(uniqueSlugs.size).toBe(slugs.length);
  });

  it('mapea correctamente externalId a slug', () => {
    expect(HIGHLIGHTLY_SLUG_BY_EXTERNAL_ID.get('46738')).toBe('champions-cup');
    expect(HIGHLIGHTLY_SLUG_BY_EXTERNAL_ID.get('68864')).toBe('bunnings-npc');
    expect(HIGHLIGHTLY_SLUG_BY_EXTERNAL_ID.get('32271')).toBe('currie-cup');
    expect(HIGHLIGHTLY_SLUG_BY_EXTERNAL_ID.get('59503')).toBe('rugby-world-cup');
  });
});
