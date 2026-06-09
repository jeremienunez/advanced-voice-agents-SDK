export type PendingActionStatus =
  | "confirmation_required"
  | "approved"
  | "rejected"
  | "expired"
  | "executed"
  | "failed";

export interface PendingActionCreateInput {
  sessionId: string;
  tenantId?: string;
  userId?: string;
  providerId?: string;
  toolName: string;
  arguments: Record<string, unknown>;
  sideEffect?: string;
  reason?: string;
  expiresAt?: string;
  metadata?: Record<string, unknown>;
}

export interface PendingActionRecord extends PendingActionCreateInput {
  id: string;
  status: PendingActionStatus;
  createdAt: string;
  resolvedAt?: string;
}

export interface PendingActionResolveInput {
  id: string;
  status: Exclude<PendingActionStatus, "confirmation_required">;
  reason?: string;
}

export interface PendingActionPort {
  create(
    input: PendingActionCreateInput,
  ): PendingActionRecord | Promise<PendingActionRecord>;
  get?(id: string): PendingActionRecord | null | Promise<PendingActionRecord | null>;
  resolve?(
    input: PendingActionResolveInput,
  ): PendingActionRecord | Promise<PendingActionRecord>;
}
