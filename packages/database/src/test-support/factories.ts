import type { Database } from '../client';
import {
  competitions,
  externalSources,
  matches,
  predictionContests,
  seasons,
  teams,
  users,
} from '../schema';

let counter = 0;
function uniqueSuffix(): string {
  counter += 1;
  return `${Date.now().toString(36)}-${counter}`;
}

export async function makeTeam(db: Database, overrides: Partial<typeof teams.$inferInsert> = {}) {
  const suffix = uniqueSuffix();
  const [row] = await db
    .insert(teams)
    .values({
      slug: overrides.slug ?? `team-${suffix}`,
      name: overrides.name ?? `Team ${suffix}`,
      shortName: overrides.shortName ?? 'TM',
      countryCode: overrides.countryCode ?? 'AR',
      ...overrides,
    })
    .returning();
  return row!;
}

export async function makeCompetition(
  db: Database,
  overrides: Partial<typeof competitions.$inferInsert> = {},
) {
  const suffix = uniqueSuffix();
  const [row] = await db
    .insert(competitions)
    .values({
      slug: overrides.slug ?? `comp-${suffix}`,
      name: overrides.name ?? `Competition ${suffix}`,
      category: overrides.category ?? 'clubs',
      gender: overrides.gender ?? 'male',
      ...overrides,
    })
    .returning();
  return row!;
}

export async function makeSeason(
  db: Database,
  competitionId: string,
  overrides: Partial<typeof seasons.$inferInsert> = {},
) {
  const [row] = await db
    .insert(seasons)
    .values({
      competitionId,
      name: overrides.name ?? '2026',
      year: overrides.year ?? 2026,
      ...overrides,
    })
    .returning();
  return row!;
}

export async function makeUser(db: Database, overrides: Partial<typeof users.$inferInsert> = {}) {
  const suffix = uniqueSuffix();
  const [row] = await db
    .insert(users)
    .values({
      email: overrides.email ?? `user-${suffix}@example.test`,
      displayName: overrides.displayName ?? `User ${suffix}`,
      ...overrides,
    })
    .returning();
  return row!;
}

export async function makeSource(
  db: Database,
  overrides: Partial<typeof externalSources.$inferInsert> = {},
) {
  const suffix = uniqueSuffix();
  const [row] = await db
    .insert(externalSources)
    .values({
      slug: overrides.slug ?? `source-${suffix}`,
      name: overrides.name ?? `Source ${suffix}`,
      ...overrides,
    })
    .returning();
  return row!;
}

export async function makeMatch(
  db: Database,
  input: { seasonId: string; homeTeamId: string; awayTeamId: string } & Partial<
    typeof matches.$inferInsert
  >,
) {
  const [row] = await db
    .insert(matches)
    .values({
      round: input.round ?? 'Fecha 1',
      startsAt: input.startsAt ?? new Date('2026-08-01T18:00:00Z'),
      ...input,
    })
    .returning();
  return row!;
}

export async function makeContest(
  db: Database,
  overrides: Partial<typeof predictionContests.$inferInsert> = {},
) {
  const suffix = uniqueSuffix();
  const [row] = await db
    .insert(predictionContests)
    .values({
      slug: overrides.slug ?? `contest-${suffix}`,
      name: overrides.name ?? `Contest ${suffix}`,
      ...overrides,
    })
    .returning();
  return row!;
}
