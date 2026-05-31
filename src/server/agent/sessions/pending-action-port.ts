import type {
  PendingActionCreateInput,
  PendingActionPort,
  PendingActionRecord,
  PendingActionResolveInput,
} from "../../../sdk/types.js";

export interface InMemoryPendingActionPortOptions {
  defaultTtlMs?: number;
  idFactory?: () => string;
  maxPendingActionsPerSession?: number;
  now?: () => Date;
}

export function createInMemoryPendingActionPort(
  options: InMemoryPendingActionPortOptions = {},
): PendingActionPort {
  return new InMemoryPendingActionPort(options);
}

class InMemoryPendingActionPort implements PendingActionPort {
  private readonly actions = new Map<string, PendingActionRecord>();

  constructor(private readonly options: InMemoryPendingActionPortOptions) {}

  create(input: PendingActionCreateInput): PendingActionRecord {
    const now = this.options.now?.() ?? new Date();
    this.expireOpenActions(now);
    this.assertPendingQuota(input.sessionId);
    const action: PendingActionRecord = {
      ...input,
      arguments: { ...input.arguments },
      id: this.options.idFactory?.() ?? `pending_${crypto.randomUUID()}`,
      status: "confirmation_required",
      createdAt: now.toISOString(),
      expiresAt: input.expiresAt ?? expiresAt(now, this.options.defaultTtlMs),
    };
    this.actions.set(action.id, action);
    return action;
  }

  get(id: string): PendingActionRecord | null {
    this.expireAction(id, this.options.now?.() ?? new Date());
    return this.actions.get(id) ?? null;
  }

  resolve(input: PendingActionResolveInput): PendingActionRecord {
    this.expireAction(input.id, this.options.now?.() ?? new Date());
    const current = this.actions.get(input.id);
    if (!current) throw new Error(`Unknown pending action "${input.id}"`);
    if (current.status === "expired" && input.status !== "expired") {
      throw new Error(`Pending action "${input.id}" is expired`);
    }
    const now = this.options.now?.() ?? new Date();
    const resolved: PendingActionRecord = {
      ...current,
      status: input.status,
      reason: input.reason ?? current.reason,
      resolvedAt: now.toISOString(),
    };
    this.actions.set(resolved.id, resolved);
    return resolved;
  }

  private assertPendingQuota(sessionId: string): void {
    const limit = this.options.maxPendingActionsPerSession;
    if (!Number.isFinite(limit) || !limit || limit < 1) return;
    const open = Array.from(this.actions.values()).filter((action) =>
      action.sessionId === sessionId && isOpen(action.status)
    ).length;
    if (open >= limit) {
      throw new Error(
        `Pending action session "${sessionId}" exceeded maxPendingActionsPerSession ${limit}`,
      );
    }
  }

  private expireOpenActions(now: Date): void {
    for (const action of this.actions.values()) {
      if (isOpen(action.status) && isExpired(action, now)) {
        this.actions.set(action.id, expiredAction(action, now));
      }
    }
  }

  private expireAction(id: string, now: Date): void {
    const action = this.actions.get(id);
    if (action && isOpen(action.status) && isExpired(action, now)) {
      this.actions.set(id, expiredAction(action, now));
    }
  }
}

function expiresAt(now: Date, ttlMs: number | undefined): string | undefined {
  if (!Number.isFinite(ttlMs) || !ttlMs || ttlMs < 1) return undefined;
  return new Date(now.getTime() + ttlMs).toISOString();
}

function isExpired(action: PendingActionRecord, now: Date): boolean {
  return Boolean(action.expiresAt && Date.parse(action.expiresAt) <= now.getTime());
}

function isOpen(status: PendingActionRecord["status"]): boolean {
  return status === "confirmation_required" || status === "approved";
}

function expiredAction(
  action: PendingActionRecord,
  now: Date,
): PendingActionRecord {
  return {
    ...action,
    status: "expired",
    resolvedAt: now.toISOString(),
  };
}
