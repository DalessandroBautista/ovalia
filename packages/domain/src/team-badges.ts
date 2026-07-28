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
