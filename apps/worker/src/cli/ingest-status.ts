import 'dotenv/config';
import { createDatabase, listRecentRuns } from '@ovalia/database';

async function main() {
  const connectionString =
    process.env.DATABASE_URL ?? 'postgres://ovalia:ovalia@localhost:54329/ovalia';
  const { db, pool } = createDatabase(connectionString);
  try {
    const runs = await listRecentRuns(db, 20);
    if (runs.length === 0) {
      console.log('Sin corridas de ingestión registradas.');
      return;
    }
    for (const run of runs) {
      const finished = run.finishedAt ? run.finishedAt.toISOString() : 'en curso';
      console.log(
        `${run.startedAt.toISOString()}  ${run.provider.padEnd(14)}  ${run.status.padEnd(8)}  ${finished}` +
          (run.error ? `  error=${run.error}` : ''),
      );
    }
  } finally {
    await pool.end();
  }
}

void main();
