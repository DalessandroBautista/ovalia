import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { createDatabase, findSourceBySlug } from '@ovalia/database';
import { importMatchesCsv } from '../ingestion/csv/matches-csv';

interface Args {
  file?: string;
  source: string;
  confirm: boolean;
}

function parseArgs(argv: string[]): Args {
  const args: Args = { source: 'manual', confirm: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--file') args.file = argv[++i];
    else if (arg === '--source') args.source = argv[++i] ?? 'manual';
    else if (arg === '--confirm') args.confirm = true;
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.file) {
    console.error('Uso: pnpm ingest:csv --file <ruta.csv> [--source manual] [--confirm]');
    process.exit(1);
  }
  const content = readFileSync(args.file, 'utf8');
  const connectionString =
    process.env.DATABASE_URL ?? 'postgres://ovalia:ovalia@localhost:54329/ovalia';
  const { db, pool } = createDatabase(connectionString);
  try {
    const source = await findSourceBySlug(db, args.source);
    if (!source) {
      console.error(`Fuente desconocida: ${args.source}`);
      process.exit(1);
    }
    const report = await importMatchesCsv({
      db,
      sourceId: source.id,
      content,
      dryRun: !args.confirm,
    });
    console.log(
      `${args.confirm ? 'IMPORT' : 'DRY-RUN'}: filas=${report.totalRows} ` +
        `${args.confirm ? 'persistidos' : 'a persistir'}=${report.persisted} ` +
        `conflictos=${report.conflicts} errores=${report.errors.length}`,
    );
    for (const err of report.errors) console.error(`  línea ${err.line}: ${err.message}`);
    if (!args.confirm) console.log('Repetí con --confirm para aplicar.');
  } finally {
    await pool.end();
  }
}

void main();
