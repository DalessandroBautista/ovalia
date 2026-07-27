import { and, eq, sql } from 'drizzle-orm';
import type { Database } from '../client.js';
import { teams } from '../schema.js';

export type TeamInput = {
  slug: string;
  name: string;
  shortName: string;
  countryCode: string;
  union?: string | null;
  aliases?: string[];
  externalIds?: Record<string, string | number>;
  badgeUrl?: string | null;
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
