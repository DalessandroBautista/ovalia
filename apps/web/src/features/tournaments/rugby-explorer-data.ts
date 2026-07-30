import type { ApiCompetition, ApiOrganization } from '../../lib/api/types';
import type { AgendaMatch } from '../matches/agenda-data';

export interface RugbyExplorerFamily {
  key: string;
  title: string;
  priority: number;
  canonicalSlug: string;
  divisions: ApiCompetition[];
}

export interface RugbyExplorerUnion {
  key: string;
  label: string;
  shortLabel: string;
  families: RugbyExplorerFamily[];
}

const unionShortLabels: Record<string, string> = {
  'alto-valle': 'Alto Valle',
  andina: 'Andina',
  austral: 'Austral',
  urba: 'URBA',
  'valle-del-chubut': 'Valle del Chubut',
  cordoba: 'Córdoba',
  cuyo: 'Cuyo',
  entrerriana: 'Entre Ríos',
  formosa: 'Formosa',
  jujuy: 'Jujuy',
  'lagos-del-sur': 'Lagos del Sur',
  'mar-del-plata': 'Mar del Plata',
  misiones: 'Misiones',
  nordeste: 'Nordeste',
  uroba: 'UROBA',
  rosario: 'Rosario',
  salta: 'Salta',
  'san-juan': 'San Juan',
  'san-luis': 'San Luis',
  'santa-fe': 'Santa Fe',
  'santa-cruz': 'Santa Cruz',
  'santiago-del-estero': 'Santiago del Estero',
  sur: 'Sur',
  'tierra-del-fuego': 'Tierra del Fuego',
  tucuman: 'Tucumán',
};

export function splitCompetitionName(name: string): { familyTitle: string; divisionLabel: string } {
  const parts = name.split(' - ');
  if (parts.length >= 2) {
    return {
      familyTitle: parts[0]!,
      divisionLabel: parts.slice(1).join(' - '),
    };
  }
  return { familyTitle: name, divisionLabel: 'Principal' };
}

export function normalizedFamilyKey(competition: ApiCompetition): string {
  if (competition.familySlug) return competition.familySlug;
  return splitCompetitionName(competition.name).familyTitle
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-');
}

function divisionRank(competition: ApiCompetition): number {
  const label = splitCompetitionName(competition.name).divisionLabel.toLowerCase();
  if (/^(superior|primera\b|primera divisi[oó]n)/.test(label)) return 0;
  if (/^intermedia/.test(label)) return 1;
  if (/^pre[\s-]?intermedia/.test(label)) return 2;
  if (/menores de 22|^m22/.test(label)) return 3;
  if (/^m19|menores de 19/.test(label)) return 10;
  if (/^m17|menores de 17/.test(label)) return 11;
  if (/^m16|menores de 16/.test(label)) return 12;
  if (/^m15|menores de 15/.test(label)) return 13;
  if (competition.tier === 'women') return 20;
  if (competition.tier === 'youth') return 30;
  return 50;
}

export function sortDivisions(competitions: ApiCompetition[]): ApiCompetition[] {
  return [...competitions].sort((left, right) => {
    const rankDiff = divisionRank(left) - divisionRank(right);
    if (rankDiff !== 0) return rankDiff;
    const priorityDiff = right.priority - left.priority;
    if (priorityDiff !== 0) return priorityDiff;
    return splitCompetitionName(left.name).divisionLabel.localeCompare(splitCompetitionName(right.name).divisionLabel, 'es');
  });
}

export function buildRugbyExplorer(
  organizations: ApiOrganization[],
  competitions: ApiCompetition[],
): RugbyExplorerUnion[] {
  const competitionsBySlug = new Map(competitions.map((competition) => [competition.slug, competition]));
  return organizations
    .filter((organization) => organization.kind === 'union' && organization.countryCode === 'AR')
    .map((organization) => {
      const families = new Map<string, Omit<RugbyExplorerFamily, 'canonicalSlug'>>();
      for (const competitionSlug of new Set(organization.competitionSlugs)) {
        const competition = competitionsBySlug.get(competitionSlug);
        if (!competition) continue;
        const key = normalizedFamilyKey(competition);
        const current = families.get(key) ?? {
          key,
          title: splitCompetitionName(competition.name).familyTitle,
          priority: competition.priority,
          divisions: [],
        };
        current.priority = Math.max(current.priority, competition.priority);
        current.divisions.push(competition);
        families.set(key, current);
      }
      const orderedFamilies = [...families.values()]
        .map((family) => {
          const divisions = sortDivisions(family.divisions);
          return { ...family, canonicalSlug: divisions[0]!.slug, divisions };
        })
        .sort((left, right) => right.priority - left.priority || left.title.localeCompare(right.title, 'es'));
      return {
        key: organization.slug,
        label: organization.name,
        shortLabel: unionShortLabels[organization.slug] ?? organization.name,
        families: orderedFamilies,
      };
    })
    .sort((left, right) => {
      const leftPriority = left.families[0]?.priority ?? -1;
      const rightPriority = right.families[0]?.priority ?? -1;
      return rightPriority - leftPriority || left.label.localeCompare(right.label, 'es');
    });
}

export function filterMatchesByFamily(
  matches: AgendaMatch[],
  familyKey: string,
  competitions: ApiCompetition[],
): AgendaMatch[] {
  if (!familyKey) return matches;
  const competitionSlugs = new Set(
    competitions
      .filter((competition) => normalizedFamilyKey(competition) === familyKey)
      .map((competition) => competition.slug),
  );
  return matches.filter((match) => match.competitionSlug && competitionSlugs.has(match.competitionSlug));
}
