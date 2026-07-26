import { desc } from 'drizzle-orm';
import type { Database } from '../client.js';
import { auditLog } from '../schema.js';

export type AuditEntry = {
  actorId?: string | null;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  metadata?: Record<string, unknown>;
};

export async function recordAudit(db: Database, entry: AuditEntry) {
  const [row] = await db
    .insert(auditLog)
    .values({
      actorId: entry.actorId ?? null,
      action: entry.action,
      targetType: entry.targetType ?? null,
      targetId: entry.targetId ?? null,
      metadata: entry.metadata ?? {},
    })
    .returning();
  return row!;
}

export function listAudit(db: Database, limit = 100) {
  return db.query.auditLog.findMany({ orderBy: desc(auditLog.createdAt), limit });
}
