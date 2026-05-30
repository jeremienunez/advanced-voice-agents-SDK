import type {
  PendingActionCreateInput,
  PendingActionPort,
  PendingActionRecord,
  PendingActionResolveInput,
} from "../../../sdk/types.js";

export interface InMemoryPendingActionPortOptions {
  idFactory?: () => string;
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
    const action: PendingActionRecord = {
      ...input,
      arguments: { ...input.arguments },
      id: this.options.idFactory?.() ?? `pending_${crypto.randomUUID()}`,
      status: "confirmation_required",
      createdAt: now.toISOString(),
    };
    this.actions.set(action.id, action);
    return action;
  }

  get(id: string): PendingActionRecord | null {
    return this.actions.get(id) ?? null;
  }

  resolve(input: PendingActionResolveInput): PendingActionRecord {
    const current = this.actions.get(input.id);
    if (!current) throw new Error(`Unknown pending action "${input.id}"`);
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
}
