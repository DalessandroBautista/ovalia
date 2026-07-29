import 'dotenv/config';
import { createDatabase, findSourceBySlug } from '@ovalia/database';
import type { Capability } from '@ovalia/domain';
import { getAdapter, registeredSources } from '../ingestion/adapter-registry';
import '../ingestion/register-adapters';
import { runIngestion } from '../ingestion/run-ingestion';
import { importUrba } from '../ingestion/adapters/urba';

interface Args {
  source?: string;
  capability?: Capability;
  competition?: string;
  all?: boolean;
  dryRun?: boolean;
}

function parseArgs(argv: string[]): Args {
  const args: Args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--source') args.source = argv[++i];
    else if (arg === '--capability') args.capability = argv[++i] as Capability;
    else if (arg === '--competition') args.competition = argv[++i];
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
    // URBA con --all: catálogo + fixtures/posiciones por competencia prioritaria.
    if (args.source === 'urba' && args.all) {
      const report = await importUrba({
        db,
        sourceId: source.id,
        dryRun: args.dryRun,
        competitionExternalIds: args.competition ? [args.competition] : undefined,
      });
      console.log(`[urba/catalog] ${report.catalog.status} persisted=${report.catalog.persisted}`);
      for (const comp of report.perCompetition) {
        console.log(
          `[urba/${comp.name}] fixtures=${comp.fixtures.status}(${comp.fixtures.persisted}/${comp.fixtures.conflicts}) ` +
            `standings=${comp.standings.status}(${comp.standings.persisted}/${comp.standings.conflicts})`,
        );
      }
      return;
    }

    // Highlightly con --all: catálogo curado + fixtures/posiciones por competencia.
    if (args.source === 'highlightly-ingest' && args.all) {
      const { importHighlightly } = await import('../ingestion/adapters/highlightly/highlightly-import');
      const report = await importHighlightly({ db, sourceId: source.id, dryRun: args.dryRun });
      console.log(`[highlightly/catalog] ${report.catalog.status} persisted=${report.catalog.persisted}`);
      for (const comp of report.perCompetition) {
        console.log(
          `[highlightly/${comp.name}] fixtures=${comp.fixtures.status}(${comp.fixtures.persisted}/${comp.fixtures.conflicts}) ` +
            `standings=${comp.standings.status}(${comp.standings.persisted}/${comp.standings.conflicts})`,
        );
      }
      return;
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
    const context = args.competition ? { competitionExternalId: args.competition } : {};
    for (const capability of capabilities) {
      const result = await runIngestion({
        db,
        sourceId: source.id,
        adapter,
        capability,
        parserVersion: process.env.PARSER_VERSION ?? 'dev',
        context,
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
