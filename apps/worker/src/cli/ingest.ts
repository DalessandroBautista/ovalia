import 'dotenv/config';
import { createDatabase, findSourceBySlug } from '@ovalia/database';
import type { Capability } from '@ovalia/domain';
import { getAdapter, registeredSources } from '../ingestion/adapter-registry';
import '../ingestion/register-adapters';
import { runIngestion } from '../ingestion/run-ingestion';

interface Args {
  source?: string;
  capability?: Capability;
  all?: boolean;
  dryRun?: boolean;
}

function parseArgs(argv: string[]): Args {
  const args: Args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--source') args.source = argv[++i];
    else if (arg === '--capability') args.capability = argv[++i] as Capability;
    else if (arg === '--all') args.all = true;
    else if (arg === '--dry-run') args.dryRun = true;
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.source) {
    console.error('Uso: pnpm ingest --source <slug> [--capability <cap>|--all] [--dry-run]');
    process.exit(1);
  }
  const connectionString =
    process.env.DATABASE_URL ?? 'postgres://ovalia:ovalia@localhost:54329/ovalia';
  const { db, pool } = createDatabase(connectionString);
  try {
    const source = await findSourceBySlug(db, args.source);
    if (!source) {
      console.error(`Fuente desconocida: ${args.source}`);
      process.exit(1);
    }
    const adapter = getAdapter(args.source);
    if (!adapter) {
      console.error(
        `Sin adaptador registrado para "${args.source}". ` +
          `Disponibles: ${registeredSources().join(', ') || '(ninguno todavía)'}. ` +
          'Usá importación CSV/manual mientras el adaptador no exista.',
      );
      process.exit(2);
    }
    const capabilities: Capability[] = args.all
      ? adapter.descriptor.capabilities.filter((c) => c !== 'live')
      : args.capability
        ? [args.capability]
        : [];
    if (capabilities.length === 0) {
      console.error('Especificá --capability <cap> o --all.');
      process.exit(1);
    }
    for (const capability of capabilities) {
      const result = await runIngestion({
        db,
        sourceId: source.id,
        adapter,
        capability,
        parserVersion: process.env.PARSER_VERSION ?? 'dev',
        dryRun: args.dryRun,
      });
      console.log(
        `[${args.source}/${capability}] ${result.status} ` +
          `persisted=${result.persisted} conflicts=${result.conflicts}` +
          (result.error ? ` error=${result.error}` : ''),
      );
    }
  } finally {
    await pool.end();
  }
}

void main();
