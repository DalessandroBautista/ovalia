import { and, asc, eq, inArray, notInArray, or, sql } from 'drizzle-orm';
import type { Database } from '../client.js';
import { competitions, matches, seasons, standings, teams } from '../schema.js';

export type TeamInput = {
  slug: string;
  name: string;
  shortName: string;
  countryCode: string;
  union?: string | null;
  aliases?: string[];
  externalIds?: Record<string, string | number>;
  badgeUrl?: string | null;
  badgeSourceUrl?: string | null;
  badgeFormat?: string | null;
  active?: boolean;
};

export function findTeamBySlug(db: Database, slug: string) {
  return db.query.teams.findFirst({ where: eq(teams.slug, slug) });
}

export function findTeamById(db: Database, id: string) {
  return db.query.teams.findFirst({ where: eq(teams.id, id) });
}

export function listActiveTeams(db: Database) {
  return db.query.teams.findMany({ where: eq(teams.active, true) });
}

export function listTeams(db: Database) {
  return db.query.teams.findMany();
}

export function countActiveTeams(db: Database): Promise<number> {
  return db.$count(teams, eq(teams.active, true));
}

export function findTeamByExternalId(db: Database, provider: string, externalId: string) {
  return db.query.teams.findFirst({
    where: sql`${teams.externalIds} ->> ${provider} = ${externalId}`,
  });
}

/** Upsert por slug de un lote de equipos dentro de una transacción. */
export async function upsertTeams(db: Database, inputs: TeamInput[]): Promise<void> {
  if (inputs.length === 0) return;
  await db.transaction(async (tx) => {
    for (const input of inputs) {
      const values = {
        slug: input.slug,
        name: input.name,
        shortName: input.shortName,
        countryCode: input.countryCode,
        union: input.union ?? null,
        aliases: input.aliases ?? [],
        externalIds: input.externalIds ?? {},
        badgeUrl: input.badgeUrl ?? null,
        badgeSourceUrl: input.badgeSourceUrl ?? null,
        badgeFormat: input.badgeFormat ?? null,
        active: input.active ?? true,
      };
      await tx
        .insert(teams)
        .values(values)
        .onConflictDoUpdate({
          target: teams.slug,
          set: {
            name: values.name,
            shortName: values.shortName,
            countryCode: values.countryCode,
            union: values.union,
            aliases: values.aliases,
            // Los external IDs se fusionan para no perder proveedores previos.
            externalIds: sql`${teams.externalIds} || ${JSON.stringify(values.externalIds)}::jsonb`,
            active: values.active,
            // El badge solo se pisa cuando llega uno nuevo; si el upsert no trae
            // badgeUrl, se conserva el que ya estaba (curado a mano o de un ingest previo).
            badgeUrl: values.badgeUrl ? values.badgeUrl : teams.badgeUrl,
            badgeSourceUrl: values.badgeUrl ? values.badgeSourceUrl : teams.badgeSourceUrl,
            badgeFormat: values.badgeUrl ? values.badgeFormat : teams.badgeFormat,
            badgeStatus: values.badgeUrl ? 'verified' : teams.badgeStatus,
            badgeVerifiedAt: values.badgeUrl ? new Date() : teams.badgeVerifiedAt,
          },
        });
    }
  });
}

/** Agrega un alias normalizado sin duplicarlo. */
export async function addTeamAlias(db: Database, teamId: string, alias: string): Promise<void> {
  const team = await db.query.teams.findFirst({ where: eq(teams.id, teamId) });
  if (!team) return;
  if (team.aliases.includes(alias)) return;
  await db
    .update(teams)
    .set({ aliases: [...team.aliases, alias] })
    .where(and(eq(teams.id, teamId)));
}

export type TeamSummary = {
  id: string;
  slug: string;
  name: string;
  shortName: string;
  badgeUrl: string | null;
};

export async function listTeamsForCompetition(
  db: Database,
  competitionId: string,
): Promise<TeamSummary[]> {
  const comp = await db.query.competitions.findFirst({
    where: eq(competitions.id, competitionId),
    with: { organization: true },
  });
  if (!comp) return [];

  const compSeasons = await db
    .select({ id: seasons.id })
    .from(seasons)
    .where(eq(seasons.competitionId, competitionId));
  const seasonIds = compSeasons.map((s) => s.id);

  if (seasonIds.length > 0) {
    const standingsTeams = await db
      .selectDistinct({
        id: teams.id,
        slug: teams.slug,
        name: teams.name,
        shortName: teams.shortName,
        badgeUrl: teams.badgeUrl,
      })
      .from(standings)
      .innerJoin(teams, eq(standings.teamId, teams.id))
      .where(inArray(standings.seasonId, seasonIds))
      .orderBy(asc(teams.name));

    if (standingsTeams.length > 0) return standingsTeams;

    const homeMatches = await db
      .selectDistinct({
        id: teams.id,
        slug: teams.slug,
        name: teams.name,
        shortName: teams.shortName,
        badgeUrl: teams.badgeUrl,
      })
      .from(matches)
      .innerJoin(teams, eq(matches.homeTeamId, teams.id))
      .where(inArray(matches.seasonId, seasonIds));

    const awayMatches = await db
      .selectDistinct({
        id: teams.id,
        slug: teams.slug,
        name: teams.name,
        shortName: teams.shortName,
        badgeUrl: teams.badgeUrl,
      })
      .from(matches)
      .innerJoin(teams, eq(matches.awayTeamId, teams.id))
      .where(inArray(matches.seasonId, seasonIds));

    const matchTeamsMap = new Map<string, TeamSummary>();
    for (const t of [...homeMatches, ...awayMatches]) {
      matchTeamsMap.set(t.id, t);
    }
    if (matchTeamsMap.size > 0) {
      return [...matchTeamsMap.values()].sort((a, b) => a.name.localeCompare(b.name, 'es'));
    }
  }

  // Un slug canónico por selección: la base tiene alias duplicados (ej. 'pumas'
  // y 'argentina', 'nueva-zelanda' y 'new-zealand') de distintas fuentes de datos;
  // listamos solo el slug con badge real de Highlightly para no duplicar filas.
  // También sirve para excluir selecciones nacionales de ligas domésticas cuando
  // el fallback por país sería demasiado amplio (ej. Argentina en el Top 10 de Córdoba).
  const nationalSlugs = ['argentina', 'australia', 'new-zealand', 'south-africa'];

  if (
    comp.category === 'national-teams' ||
    comp.organization?.kind === 'international' ||
    comp.familySlug === 'rugby-championship'
  ) {
    const intlTeams = await db
      .select({
        id: teams.id,
        slug: teams.slug,
        name: teams.name,
        shortName: teams.shortName,
        badgeUrl: teams.badgeUrl,
      })
      .from(teams)
      .where(and(eq(teams.active, true), inArray(teams.slug, nationalSlugs)))
      .orderBy(asc(teams.name));

    if (intlTeams.length > 0) return intlTeams;
  }

  if (comp.organization) {
    const unionTeams = await db
      .select({
        id: teams.id,
        slug: teams.slug,
        name: teams.name,
        shortName: teams.shortName,
        badgeUrl: teams.badgeUrl,
      })
      .from(teams)
      .where(and(
        eq(teams.active, true),
        or(eq(teams.union, comp.organization.name), eq(teams.union, comp.organization.slug)),
      ))
      .orderBy(asc(teams.name));

    if (unionTeams.length > 0) return unionTeams;

    // Sin equipos vinculados a la unión: el fallback por país excluye selecciones
    // nacionales (nationalSlugs) para no mezclar, ej., a Argentina en una liga provincial.
    if (comp.countryCode) {
      const countryTeams = await db
        .select({
          id: teams.id,
          slug: teams.slug,
          name: teams.name,
          shortName: teams.shortName,
          badgeUrl: teams.badgeUrl,
        })
        .from(teams)
        .where(and(
          eq(teams.active, true),
          eq(teams.countryCode, comp.countryCode),
          notInArray(teams.slug, nationalSlugs),
        ))
        .orderBy(asc(teams.name));

      return countryTeams;
    }
  }

  return [];
}
