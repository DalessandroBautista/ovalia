import { describe, expect, it } from 'vitest';

import { findTeamBadge, resolveTeamBadge } from './team-badges';

describe('team badge registry', () => {
  it('finds a local badge through a normalized alias', () => {
    expect(findTeamBadge({ name: 'Sudafrica' })).toMatchObject({
      slug: 'sudafrica',
      badgePath: '/teams/sudafrica.svg',
    });
  });

  it('prefers a registered local asset over a remote provider URL', () => {
    expect(
      resolveTeamBadge({
        name: 'South Africa',
        remoteUrl: 'https://img.example/south-africa.png',
      }),
    ).toBe('/teams/sudafrica.svg');
  });

  it('uses a verified remote URL for an unknown team', () => {
    expect(
      resolveTeamBadge({
        name: 'Cheetahs',
        remoteUrl: 'https://highlightly.net/rugby/images/teams/251829.png',
      }),
    ).toBe('https://highlightly.net/rugby/images/teams/251829.png');
  });

  it('returns undefined when neither local nor remote asset exists', () => {
    expect(resolveTeamBadge({ name: 'Equipo sin registrar' })).toBeUndefined();
  });
});
