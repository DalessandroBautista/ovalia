import { sql } from 'drizzle-orm';
import { createDatabase } from '../src/client.js';

/**
 * Limpieza de temporadas "fantasma": temporadas sin partidos ni posiciones que
 * quedaron de ingestas previas. Un adaptador fijaba el año actual en el catálogo
 * (p.ej. Highlightly → 2026) y tras corregir la temporada a la real por liga
 * (2025) la 2026 quedó vacía en la BD.
 *
 * Uso:
 *   dry-run:  pnpm --filter @ovalia/database exec tsx scripts/purge-orphan-seasons.ts --dry-run
 *   aplicar:  pnpm --filter @ovalia/database exec tsx scripts/purge-orphan-seasons.ts
 *
 * Seguridad: solo se borran temporadas SIN matches y SIN standings. Nada más.
 */

const DRY_RUN = process.argv.includes('--dry-run');
const MIN_YEAR = 2020;

interface OrphanSeason {
  id: string;
  year: number;
  competition_slug: string;
  competition_name: string;
}async function main() {
  const connectionString =
    process.env.DATABASE_URL ?? 'postgres://ovalia:ovalia@localhost:54329/ovalia';
  const { db, pool } = createDatabase(connectionString);
  try {
    const { rows } = await db.execute(sql`
      SELECT s.id, s.year, c.slug AS competition_slug, c.name AS competition_name
      FROM seasons s
      JOIN competitions c ON c.id = s.competition_id
      WHERE s.year >= ${MIN_YEAR}
        AND NOT EXISTS (SELECT 1 FROM matches m WHERE m.season_id = s.id)
        AND NOT EXISTS (SELECT 1 FROM standings st WHERE st.season_id = s.id)
      ORDER BY c.slug, s.year
    `);
    const orphans = rows as unknown as OrphanSeason[];

    console.log(`Temporadas sin matches ni standings desde ${MIN_YEAR}: ${orphans.length}`);
    const byComp = new Map<string, number[]>();
    for (const r of orphans) {
      byComp.set(r.competition_slug, [...(byComp.get(r.competition_slug) ?? []), r.year]);
    }
    for (const [slug, years] of [...byComp.entries()].sort()) {
      console.log(`  ${slug}: ${years.join(', ')}`);
    }

    if (DRY_RUN) {
      console.log('(dry-run) no se borró nada.');
      return;
    }
    if (orphans.length === 0) {
      console.log('Nada que eliminar.');
      return;
    }

    for (const id of orphans.map((r) => r.id)) {
      await db.execute(sql`DELETE FROM standings st WHERE st.season_id = ${id}`);
      await db.execute(sql`DELETE FROM matches m WHERE m.season_id = ${id}`);
      await db.execute(sql`DELETE FROM seasons s WHERE s.id = ${id}`);
    }
    console.log(`Eliminadas ${orphans.length} temporadas fantasma.`);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});