import {
  listCountries,
  resolveCountryForOrganization,
} from '@ovalia/domain';
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

export interface RugbyExplorerCountry {
  code: string;
  name: string;
  shortName: string;
  flag: string;
  priority: number;
  unions: RugbyExplorerUnion[];
}

const unionShortLabels: Record<string, string> = {
  'alto-valle': 'Alto Valle',
  andina: 'Andina',
  austral: 'Austral',
  urba: 'URBA',
  'valle-del-chubut': 'Valle del Chubut',
  cordoba: 'C\u00f3rdoba',
  cuyo: 'Cuyo',
  entrerriana: 'Entre R\u00edos',
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
  tucuman: 'Tucum\u00e1n',
  'super-rugby': 'Super Rugby',
  'rugby-internacional': 'Internacional',
  'rugby-seven': 'Seven',
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

function buildUnionFamilies(
  organization: ApiOrganization,
  competitionsBySlug: Map<string, ApiCompetition>,
): RugbyExplorerFamily[] {
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
  return [...families.values()]
    .map((family) => {
      const divisions = sortDivisions(family.divisions);
      return { ...family, canonicalSlug: divisions[0]!.slug, divisions };
    })
    .sort((left, right) => right.priority - left.priority || left.title.localeCompare(right.title, 'es'));
}

function buildUnion(organization: ApiOrganization, competitionsBySlug: Map<string, ApiCompetition>): RugbyExplorerUnion {
  return {
    key: organization.slug,
    label: organization.name,
    shortLabel: unionShortLabels[organization.slug] ?? organization.name,
    families: buildUnionFamilies(organization, competitionsBySlug),
  };
}

/**
 * Construye la estructura completa del explorador de torneos:
 * Pa\u00eds > Uni\u00f3n/Organizaci\u00f3n > Familia de torneo > Divisi\u00f3n/Categor\u00eda.
 *
 * Agrupa organizaciones por pa\u00eds seg\u00fan `resolveCountryForOrganization` del domain.
 * Solo incluye pa\u00edses que tienen al menos una organizaci\u00f3n con torneos.
 */
export function buildRugbyExplorer(
  organizations: ApiOrganization[],
  competitions: ApiCompetition[],
): RugbyExplorerCountry[] {
  const competitionsBySlug = new Map(competitions.map((competition) => [competition.slug, competition]));

  // Agrupar organizaciones por pa\u00eds
  const organizationsByCountry = new Map<string, ApiOrganization[]>();
  for (const organization of organizations) {
    // Solo incluir organizaciones que tienen al menos una competencia
    if (organization.competitionSlugs.length === 0) continue;
    const country = resolveCountryForOrganization(organization);
    const list = organizationsByCountry.get(country.code) ?? [];
    list.push(organization);
    organizationsByCountry.set(country.code, list);
  }

  // Construir estructura de pa\u00edses
  const countries = listCountries();
  const result: RugbyExplorerCountry[] = [];

  for (const country of countries) {
    const countryOrganizations = organizationsByCountry.get(country.code);
    if (!countryOrganizations || countryOrganizations.length === 0) continue;

    const unions = countryOrganizations
      .map((organization) => buildUnion(organization, competitionsBySlug))
      .sort((left, right) => {
        const leftPriority = left.families[0]?.priority ?? -1;
        const rightPriority = right.families[0]?.priority ?? -1;
        return rightPriority - leftPriority || left.label.localeCompare(right.label, 'es');
      });

    result.push({
      code: country.code,
      name: country.name,
      shortName: country.shortName,
      flag: country.flag,
      priority: country.priority,
      unions,
    });
  }

  return result;
}

/**
 * Versi\u00f3n legacy: devuelve todas las uniones de todos los pa\u00edses en una lista plana.
 * \u00datil para componentes que a\u00fan no soportan la jerarqu\u00eda de pa\u00edses.
 */
export function buildRugbyExplorerFlat(
  organizations: ApiOrganization[],
  competitions: ApiCompetition[],
): RugbyExplorerUnion[] {
  return buildRugbyExplorer(organizations, competitions).flatMap((country) => country.unions);
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
