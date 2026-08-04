export interface TeamBadgeRecord {
  slug: string;
  name: string;
  shortCode: string;
  aliases: readonly string[];
  badgePath: string;
  providerQuery?: string;
  sourceUrl?: string;
  externalIds?: {
    highlightly?: number;
  };
}

export const TEAM_BADGES: readonly TeamBadgeRecord[] = [
  { slug: 'argentina', name: 'Argentina', shortCode: 'ARG', aliases: ['Los Pumas', 'Argentina XV'], badgePath: '/teams/argentina.png', providerQuery: 'Argentina', sourceUrl: 'https://upload.wikimedia.org/wikipedia/en/7/74/Los_pumas_argentina_logo23.png' },
  { slug: 'sudafrica', name: 'Sudáfrica', shortCode: 'RSA', aliases: ['South Africa', 'Springboks', 'Sudafrica'], badgePath: '/teams/sudafrica.svg', providerQuery: 'South Africa', sourceUrl: 'https://upload.wikimedia.org/wikipedia/en/8/83/South_Africa_national_rugby_union_team.svg' },
  { slug: 'nueva-zelanda', name: 'Nueva Zelanda', shortCode: 'NZL', aliases: ['New Zealand', 'All Blacks'], badgePath: '/teams/nueva-zelanda.svg', providerQuery: 'New Zealand', sourceUrl: 'https://commons.wikimedia.org/wiki/Special:Redirect/file/Allblacks-logo.svg' },
  { slug: 'australia', name: 'Australia', shortCode: 'AUS', aliases: ['Wallabies'], badgePath: '/teams/australia.svg', providerQuery: 'Australia', sourceUrl: 'https://upload.wikimedia.org/wikipedia/en/0/02/WallabiesRugbyUnionLogo.svg' },

  // Clubes URBA con escudos locales en apps/web/public/teams/.
  { slug: 'sic', name: 'San Isidro Club', shortCode: 'SIC', aliases: ['SIC', 'San Isidro'], badgePath: '/teams/sic.svg', providerQuery: 'SIC', sourceUrl: 'https://api.urba.org.ar/img/clubs/sic.png' },
  { slug: 'hindu', name: 'Hindú Club', shortCode: 'HIN', aliases: ['Hindú', 'Hindu', 'Hindú Club'], badgePath: '/teams/hindu.svg', providerQuery: 'Hindú', sourceUrl: 'https://api.urba.org.ar/img/clubs/hindu.png' },
  { slug: 'casi', name: 'Club Atlético San Isidro', shortCode: 'CAS', aliases: ['CASI', 'Club Atletico San Isidro', 'Club Atlético de San Isidro'], badgePath: '/teams/casi.svg', providerQuery: 'CASI', sourceUrl: 'https://api.urba.org.ar/img/clubs/casi.png' },
  { slug: 'newman', name: 'Newman', shortCode: 'NEW', aliases: ['Newman Club', 'Deportiva Newman'], badgePath: '/teams/newman.png', providerQuery: 'Newman', sourceUrl: 'https://api.urba.org.ar/img/clubs/newman.png' },
  { slug: 'alumni', name: 'Alumni', shortCode: 'ALU', aliases: ['Alumni Athletic Club', 'Alumni Club'], badgePath: '/teams/alumni.svg', providerQuery: 'Alumni', sourceUrl: 'https://api.urba.org.ar/img/clubs/alumni.png' },
  { slug: 'cuba', name: 'Club Universitario de Buenos Aires', shortCode: 'CUBA', aliases: ['CUBA', 'Club Universitario'], badgePath: '/teams/cuba.svg', providerQuery: 'CUBA', sourceUrl: 'https://api.urba.org.ar/img/clubs/cuba.png' },
];

export function normalizeTeamName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function findTeamBadge(input: { name?: string; providerId?: number }): TeamBadgeRecord | undefined {
  if (input.providerId != null) {
    const byProvider = TEAM_BADGES.find((team) => team.externalIds?.highlightly === input.providerId);
    if (byProvider) return byProvider;
  }
  if (!input.name) return undefined;
  const candidate = normalizeTeamName(input.name);
  return TEAM_BADGES.find((team) =>
    [team.slug, team.name, team.shortCode, ...team.aliases]
      .some((name) => normalizeTeamName(name) === candidate),
  );
}

export function resolveTeamBadge(input: { name?: string; providerId?: number; remoteUrl?: string }): string | undefined {
  return findTeamBadge(input)?.badgePath ?? input.remoteUrl;
}
