// ---------------------------------------------------------------------------
// RV Trax API — Audit log service
// ---------------------------------------------------------------------------

import type { Database } from '@rv-trax/db';
import { auditLog } from '@rv-trax/db';
import type { AuditAction } from '@rv-trax/shared';

export interface LogActionParams {
  dealershipId: string;
  userId: string | null;
  action: AuditAction;
  entityType: string;
  entityId: string;
  changes?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export async function logAction(
  db: Pick<Database, 'insert'>,
  params: LogActionParams,
): Promise<void> {
  await db.insert(auditLog).values({
    dealershipId: params.dealershipId,
    userId: params.userId,
    action: params.action,
    entityType: params.entityType,
    entityId: params.entityId,
    changes: params.changes ?? null,
    ipAddress: params.ipAddress ?? null,
  });
}
