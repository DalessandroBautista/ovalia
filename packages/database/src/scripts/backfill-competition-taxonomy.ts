import { eq } from 'drizzle-orm';
import { createDatabase } from '../client.js';
import { competitions } from '../schema.js';

// --- Copia inline de deriveUrbaTaxonomy (apps/worker) para evitar imports cruzados
// en un script one-off.

type UrbaTier = 'senior' | 'intermediate' | 'youth' | 'women' | 'university';

function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function tierFromCategory(category: string): UrbaTier {
  const normalized = category.toLowerCase();
  if (/^menores de 22/.test(normalized)) return 'youth';
  if (/^(intermedia|preintermedia)/.test(normalized)) return 'intermediate';
  if (/^superior|^primera divisi[oó]n$/.test(normalized)) return 'senior';
  return 'senior';
}

function deriveUrbaTaxonomy(name: string): { familySlug: string; tier: UrbaTier } {
  if (/^femenino\b/i.test(name)) {
    return { familySlug: 'femenino', tier: 'women' };
  }
  const menoresMatch = name.match(/^menores de (\d+)/i);
  if (menoresMatch) {
    return { familySlug: `menores-de-${menoresMatch[1]}`, tier: 'youth' };
  }
  if (/^rugby universitario/i.test(name)) {
    return { familySlug: 'rugby-universitario', tier: 'university' };
  }
  if (/^rugby formativo/i.test(name)) {
    return { familySlug: 'rugby-formativo', tier: 'university' };
  }
  const parts = name.split(' - ');
  if (parts.length >= 2) {
    const [division, ...rest] = parts;
    const category = rest.join(' - ');
    return { familySlug: slugify(division!), tier: tierFromCategory(category) };
  }
  return { familySlug: slugify(name), tier: 'senior' };
}

// --- Backfill

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL requerido');
const { db, pool } = createDatabase(connectionString);

const rows = await db.select().from(competitions);
let updated = 0;
for (const row of rows) {
  const taxonomy = deriveUrbaTaxonomy(row.name);
  await db
    .update(competitions)
    .set({ familySlug: taxonomy.familySlug, tier: taxonomy.tier })
    .where(eq(competitions.id, row.id));
  updated += 1;
}
console.log(`Backfill completo: ${updated} competencias actualizadas.`);
await pool.end();
