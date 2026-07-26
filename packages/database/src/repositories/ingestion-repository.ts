import { and, desc, eq } from 'drizzle-orm';
import type { Database } from '../client.js';
import {
  externalEntities,
  externalSources,
  ingestionArtifacts,
  ingestionConflicts,
  ingestionRuns,
} from '../schema.js';

export async function upsertSource(
  db: Database,
  input: {
    slug: string;
    name: string;
    priority?: number;
    baseUrl?: string | null;
    capabilities?: string[];
    automationAllowed?: boolean;
    active?: boolean;
    attribution?: string | null;
  },
) {
  const [row] = await db
    .insert(externalSources)
    .values({
      slug: input.slug,
      name: input.name,
      priority: input.priority ?? 0,
      baseUrl: input.baseUrl ?? null,
      capabilities: input.capabilities ?? [],
      automationAllowed: input.automationAllowed ?? false,
      active: input.active ?? false,
      attribution: input.attribution ?? null,
    })
    .onConflictDoUpdate({
      target: externalSources.slug,
      set: {
        name: input.name,
        priority: input.priority ?? 0,
        baseUrl: input.baseUrl ?? null,
        capabilities: input.capabilities ?? [],
        automationAllowed: input.automationAllowed ?? false,
        active: input.active ?? false,
        attribution: input.attribution ?? null,
      },
    })
    .returning();
  return row!;
}

export function findSourceBySlug(db: Database, slug: string) {
  return db.query.externalSources.findFirst({ where: eq(externalSources.slug, slug) });
}

export function listRecentRuns(db: Database, limit = 20) {
  return db.query.ingestionRuns.findMany({ orderBy: desc(ingestionRuns.startedAt), limit });
}

export async function startRun(db: Database, provider: string) {
  const [row] = await db
    .insert(ingestionRuns)
    .values({ provider, status: 'running' })
    .returning();
  return row!;
}

export async function finishRun(
  db: Database,
  runId: string,
  result: { status: 'success' | 'failed'; payload?: unknown; error?: string | null },
) {
  await db
    .update(ingestionRuns)
    .set({
      status: result.status,
      payload: result.payload ?? {},
      error: result.error ?? null,
      finishedAt: new Date(),
    })
    .where(eq(ingestionRuns.id, runId));
}

export async function hasArtifact(db: Database, sourceId: string, checksum: string) {
  const row = await db.query.ingestionArtifacts.findFirst({
    where: and(
      eq(ingestionArtifacts.sourceId, sourceId),
      eq(ingestionArtifacts.checksum, checksum),
    ),
  });
  return row != null;
}

/** Registra un artifact de forma idempotente por (source, checksum). */
export async function recordArtifact(
  db: Database,
  input: {
    sourceId: string;
    checksum: string;
    runId?: string | null;
    capability?: string | null;
    url?: string | null;
    status?: 'pending' | 'fetched' | 'parsed' | 'failed' | 'skipped';
    contentType?: string | null;
    parserVersion?: string | null;
    rawPath?: string | null;
    payload?: unknown;
    error?: string | null;
  },
): Promise<{ created: boolean; id: string | null }> {
  const rows = await db
    .insert(ingestionArtifacts)
    .values({
      sourceId: input.sourceId,
      checksum: input.checksum,
      runId: input.runId ?? null,
      capability: input.capability ?? null,
      url: input.url ?? null,
      status: input.status ?? 'fetched',
      contentType: input.contentType ?? null,
      parserVersion: input.parserVersion ?? null,
      rawPath: input.rawPath ?? null,
      payload: input.payload ?? null,
      error: input.error ?? null,
      fetchedAt: new Date(),
    })
    .onConflictDoNothing({ target: [ingestionArtifacts.sourceId, ingestionArtifacts.checksum] })
    .returning({ id: ingestionArtifacts.id });
  const created = rows[0];
  return { created: created != null, id: created?.id ?? null };
}

export function listExternalLinks(db: Database, sourceId: string, entityType: string) {
  return db
    .select()
    .from(externalEntities)
    .where(
      and(eq(externalEntities.sourceId, sourceId), eq(externalEntities.entityType, entityType)),
    );
}

export async function resolveExternalEntity(
  db: Database,
  sourceId: string,
  entityType: string,
  externalId: string,
): Promise<string | null> {
  const row = await db.query.externalEntities.findFirst({
    where: and(
      eq(externalEntities.sourceId, sourceId),
      eq(externalEntities.entityType, entityType),
      eq(externalEntities.externalId, externalId),
    ),
  });
  return row?.ovaliaId ?? null;
}

export async function linkExternalEntity(
  db: Database,
  input: {
    sourceId: string;
    entityType: string;
    externalId: string;
    ovaliaId: string;
    confidence?: number;
    metadata?: Record<string, unknown>;
  },
) {
  const [row] = await db
    .insert(externalEntities)
    .values({
      sourceId: input.sourceId,
      entityType: input.entityType,
      externalId: input.externalId,
      ovaliaId: input.ovaliaId,
      confidence: input.confidence ?? null,
      metadata: input.metadata ?? {},
    })
    .onConflictDoUpdate({
      target: [
        externalEntities.sourceId,
        externalEntities.entityType,
        externalEntities.externalId,
      ],
      set: { ovaliaId: input.ovaliaId, confidence: input.confidence ?? null },
    })
    .returning();
  return row!;
}

export async function createConflict(
  db: Database,
  input: {
    sourceId?: string | null;
    entityType: string;
    candidates: unknown;
    reason?: string | null;
  },
) {
  const [row] = await db
    .insert(ingestionConflicts)
    .values({
      sourceId: input.sourceId ?? null,
      entityType: input.entityType,
      candidates: input.candidates ?? [],
      reason: input.reason ?? null,
    })
    .returning();
  return row!;
}
