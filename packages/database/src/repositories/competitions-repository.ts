import { and, desc, eq } from 'drizzle-orm';
import type { Database } from '../client.js';
import { competitions, seasons } from '../schema.js';

export type CompetitionInput = {
  slug: string;
  name: string;
  category: string;
  gender: string;
  countryCode?: string | null;
  format?: string;
  priority?: number;
  coverage?: string;
  organizationId?: string | null;
  familySlug?: string | null;
  tier?: string;
};

export function listCompetitions(db: Database) {
  return db.query.competitions.findMany({ with: { organization: true } });
}

export function countCoveredCompetitions(db: Database): Promise<number> {
  return db.$count(competitions, eq(competitions.coverage, 'auto'));
}

export function findCompetitionBySlug(db: Database, slug: string) {
  return db.query.competitions.findFirst({ 
    where: eq(competitions.slug, slug),
    with: { organization: true },
  });
}

export async function upsertCompetition(db: Database, input: CompetitionInput) {
  const values = {
    slug: input.slug,
    name: input.name,
    category: input.category,
    gender: input.gender,
    countryCode: input.countryCode ?? null,
    format: input.format ?? 'xv',
    priority: input.priority,
    coverage: input.coverage ?? 'manual',
    organizationId: input.organizationId,
    familySlug: input.familySlug ?? null,
    tier: input.tier ?? 'senior',
  };
  const [row] = await db
    .insert(competitions)
    .values({ ...values, priority: values.priority ?? 0, organizationId: values.organizationId ?? null })
    .onConflictDoUpdate({
      target: competitions.slug,
      set: {
        name: values.name,
        category: values.category,
        gender: values.gender,
        countryCode: values.countryCode,
        format: values.format,
        // priority y organizationId solo se actualizan si vienen explícitos en este
        // upsert; si no, se conserva el valor ya guardado (evita que una ingesta que no
        // los conoce pise una prioridad u organización curada a mano o por otra fuente).
        ...(values.priority !== undefined ? { priority: values.priority } : {}),
        coverage: values.coverage,
        ...(values.organizationId !== undefined ? { organizationId: values.organizationId } : {}),
        familySlug: values.familySlug,
        tier: values.tier,
      },
    })
    .returning();
  return row!;
}

export function findSeason(db: Database, competitionId: string, year: number) {
  return db.query.seasons.findFirst({
    where: and(eq(seasons.competitionId, competitionId), eq(seasons.year, year)),
  });
}

export function getLatestSeason(db: Database, competitionId: string) {
  return db.query.seasons.findFirst({
    where: eq(seasons.competitionId, competitionId),
    orderBy: desc(seasons.year),
  });
}

export function listSeasons(db: Database, competitionId: string) {
  return db.query.seasons.findMany({
    where: eq(seasons.competitionId, competitionId),
    orderBy: desc(seasons.year),
  });
}

export async function upsertSeason(
  db: Database,
  input: { competitionId: string; name: string; year: number; rules?: unknown },
) {
  const [row] = await db
    .insert(seasons)
    .values({
      competitionId: input.competitionId,
      name: input.name,
      year: input.year,
      rules: input.rules ?? {},
    })
    .onConflictDoUpdate({
      target: [seasons.competitionId, seasons.year],
      set: { name: input.name, rules: input.rules ?? {} },
    })
    .returning();
  return row!;
}
