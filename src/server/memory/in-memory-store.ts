import type {
  MemoryRecord,
  MemoryScope,
  MemoryStoreDeleteInput,
  MemoryStoreListInput,
  MemoryStorePort,
  MemoryStoreWriteInput,
} from "../../sdk/types.js";

export interface InMemoryMemoryStoreOptions {
  defaultTtlSeconds?: number;
  idFactory?: () => string;
  now?: () => Date;
}

export function createInMemoryMemoryStore(
  options: InMemoryMemoryStoreOptions = {},
): MemoryStorePort {
  return new InMemoryMemoryStore(options);
}

class InMemoryMemoryStore implements MemoryStorePort {
  private readonly records = new Map<string, MemoryRecord>();

  constructor(private readonly options: InMemoryMemoryStoreOptions) {}

  isConfigured(): boolean {
    return true;
  }

  write(input: MemoryStoreWriteInput): MemoryRecord {
    this.deleteExpired();
    const now = this.options.now?.() ?? new Date();
    const record = recordFromWrite(input, now, this.options);
    this.records.set(record.id, record);
    return record;
  }

  list(input: MemoryStoreListInput): MemoryRecord[] {
    this.deleteExpired();
    const records = Array.from(this.records.values())
      .filter((record) => recordMatches(record, input))
      .sort(newestFirst);
    return input.limit === undefined ? records : records.slice(0, input.limit);
  }

  delete(input: MemoryStoreDeleteInput): number {
    let deleted = 0;
    for (const [id, record] of this.records.entries()) {
      if (deleteMatches(id, record, input)) {
        this.records.delete(id);
        deleted++;
      }
    }
    return deleted;
  }

  private deleteExpired(): void {
    const now = this.options.now?.() ?? new Date();
    for (const [id, record] of this.records.entries()) {
      if (record.expiresAt && Date.parse(record.expiresAt) <= now.getTime()) {
        this.records.delete(id);
      }
    }
  }
}

function recordFromWrite(
  input: MemoryStoreWriteInput,
  now: Date,
  options: InMemoryMemoryStoreOptions,
): MemoryRecord {
  const ttlSeconds = input.ttlSeconds ?? options.defaultTtlSeconds;
  return {
    id: input.id ?? options.idFactory?.() ?? `mem_${crypto.randomUUID()}`,
    scope: { ...input.scope },
    kind: input.kind,
    value: input.value,
    createdAt: now.toISOString(),
    expiresAt: expiresAt(now, ttlSeconds),
    metadata: input.metadata,
  };
}

function expiresAt(now: Date, ttlSeconds: number | undefined): string | undefined {
  if (!ttlSeconds || ttlSeconds <= 0) return undefined;
  return new Date(now.getTime() + ttlSeconds * 1000).toISOString();
}

function recordMatches(
  record: MemoryRecord,
  input: MemoryStoreListInput,
): boolean {
  return scopeMatches(record.scope, input.scope) &&
    (!input.kind || record.kind === input.kind);
}

function deleteMatches(
  id: string,
  record: MemoryRecord,
  input: MemoryStoreDeleteInput,
): boolean {
  return (!input.id || input.id === id) &&
    (!input.kind || input.kind === record.kind) &&
    (!input.scope || scopeMatches(record.scope, input.scope));
}

function scopeMatches(record: MemoryScope, requested: MemoryScope): boolean {
  return record.tenantId === requested.tenantId &&
    (requested.userId === undefined || record.userId === requested.userId) &&
    (
      requested.sessionId === undefined ||
      record.sessionId === requested.sessionId
    ) &&
    (requested.agentId === undefined || record.agentId === requested.agentId);
}

function newestFirst(left: MemoryRecord, right: MemoryRecord): number {
  return Date.parse(right.createdAt) - Date.parse(left.createdAt);
}
