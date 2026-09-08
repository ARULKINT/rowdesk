import "server-only";
import { prisma } from "@/lib/prisma";

export type AuditAction =
  | "login"
  | "login_failed"
  | "logout"
  | "record_claimed"
  | "record_completed"
  | "record_stage_advanced"
  | "record_skipped"
  | "record_released"
  | "user_created"
  | "user_edited"
  | "user_disabled"
  | "user_enabled"
  | "password_reset"
  | "password_changed"
  | "role_changed"
  | "template_created"
  | "template_edited"
  | "template_retired"
  | "template_restored"
  | "dictionary_created"
  | "dictionary_activated"
  | "settings_changed"
  | "csv_imported"
  | "drive_connected"
  | "drive_disconnected"
  | "drive_folder_set"
  | "drive_scan"
  | "drive_import";

export async function logAudit(params: {
  userId: string | null;
  action: AuditAction;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  await prisma.auditLog.create({
    data: {
      userId: params.userId,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId ?? null,
      metadata: params.metadata ? JSON.stringify(params.metadata) : null,
    },
  });
}
