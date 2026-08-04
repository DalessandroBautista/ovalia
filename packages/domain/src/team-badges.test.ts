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

  it('finds SIC through its full name', () => {
    expect(findTeamBadge({ name: 'San Isidro Club' })).toMatchObject({
      slug: 'sic',
      badgePath: '/teams/sic.svg',
    });
  });

  it('prefers the local badge for URBA clubs over the remote URBA URL', () => {
    expect(
      resolveTeamBadge({
        name: 'SIC',
        remoteUrl: 'https://api.urba.org.ar/img/clubs/sic.png',
      }),
    ).toBe('/teams/sic.svg');
  });

  it('resolves Hindú without accent through a normalized alias', () => {
    expect(resolveTeamBadge({ name: 'Hindu' })).toBe('/teams/hindu.svg');
  });

  it('resolves URBA CASI, Newman, Alumni and CUBA to local assets', () => {
    expect(resolveTeamBadge({ name: 'CASI' })).toBe('/teams/casi.svg');
    expect(resolveTeamBadge({ name: 'Newman' })).toBe('/teams/newman.png');
    expect(resolveTeamBadge({ name: 'Alumni' })).toBe('/teams/alumni.svg');
    expect(resolveTeamBadge({ name: 'CUBA' })).toBe('/teams/cuba.svg');
  });
});
