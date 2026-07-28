import { eq } from 'drizzle-orm';
import type { Database } from '../client.js';
import { organizations } from '../schema.js';

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
