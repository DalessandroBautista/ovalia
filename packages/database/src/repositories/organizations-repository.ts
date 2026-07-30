import { and, asc, eq } from 'drizzle-orm';
import type { Database } from '../client.js';
import { competitionOrganizations, competitions, organizations } from '../schema.js';

export type OrganizationInput = {
  slug: string;
  name: string;
  kind: string;
  countryCode?: string | null;
};

export async function upsertOrganization(db: Database, input: OrganizationInput) {
  const values = {
    slug: input.slug,
    name: input.name,
    kind: input.kind,
    countryCode: input.countryCode ?? null,
  };
  const [row] = await db
    .insert(organizations)
    .values(values)
    .onConflictDoUpdate({
      target: organizations.slug,
      set: { name: values.name, kind: values.kind, countryCode: values.countryCode },
    })
    .returning();
  return row!;
}

export function findOrganizationBySlug(db: Database, slug: string) {
  return db.query.organizations.findFirst({ where: eq(organizations.slug, slug) });
}

export async function linkCompetitionOrganization(
  db: Database,
  input: { competitionId: string; organizationId: string },
) {
  const [row] = await db
    .insert(competitionOrganizations)
    .values(input)
    .onConflictDoNothing()
    .returning();
  return row ?? input;
}

export async function listOrganizationsWithCompetitionSlugs(
  db: Database,
  filters: { countryCode: string; kind: string },
) {
  const where = and(
    eq(organizations.countryCode, filters.countryCode),
    eq(organizations.kind, filters.kind),
  );
  const organizationRows = await db
    .select({
      id: organizations.id,
      slug: organizations.slug,
      name: organizations.name,
      kind: organizations.kind,
      countryCode: organizations.countryCode,
    })
    .from(organizations)
    .where(where)
    .orderBy(asc(organizations.name));
  const primaryRows = await db
    .select({ organizationId: organizations.id, competitionSlug: competitions.slug })
    .from(organizations)
    .innerJoin(competitions, eq(competitions.organizationId, organizations.id))
    .where(where);
  const linkedRows = await db
    .select({ organizationId: organizations.id, competitionSlug: competitions.slug })
    .from(organizations)
    .innerJoin(competitionOrganizations, eq(competitionOrganizations.organizationId, organizations.id))
    .innerJoin(competitions, eq(competitions.id, competitionOrganizations.competitionId))
    .where(where);
  const slugsByOrganization = new Map<string, Set<string>>();
  for (const row of [...primaryRows, ...linkedRows]) {
    const slugs = slugsByOrganization.get(row.organizationId) ?? new Set<string>();
    slugs.add(row.competitionSlug);
    slugsByOrganization.set(row.organizationId, slugs);
  }
  return organizationRows.map((organization) => ({
    ...organization,
    competitionSlugs: [...(slugsByOrganization.get(organization.id) ?? [])].sort(),
  }));
}
