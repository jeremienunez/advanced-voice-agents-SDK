import type {
  MemoryRecord,
  MemoryScope,
  MemoryStoreListInput,
  MemoryStorePort,
  MemoryStoreWriteInput,
} from "@voiceagentsdk/core/sdk";
import { createClient } from "redis";
import type { RedisRuntimeMemoryStoreOptions } from "./types.js";

type RedisConnection = {
  isOpen: boolean;
  connect(): Promise<unknown>;
  del(keys: string | string[]): Promise<unknown>;
  mGet(keys: string[]): Promise<Array<string | null>>;
  on?(event: "error", listener: (error: Error) => void): unknown;
  ping(): Promise<string>;
  quit(): Promise<unknown>;
  sAdd(key: string, members: string | string[]): Promise<unknown>;
  sMembers(key: string): Promise<string[]>;
  sRem(key: string, members: string | string[]): Promise<unknown>;
  set(key: string, value: string, options?: { EX: number }): Promise<unknown>;
};

export class RedisRuntimeMemoryStore implements MemoryStorePort {
  private client?: RedisConnection;
  private readonly namespace: string;

  constructor(private readonly options: RedisRuntimeMemoryStoreOptions) {
    this.namespace = options.namespace ?? "agent-runtime";
  }

  isConfigured(): boolean {
    return Boolean(this.options.redisUrl);
  }

  async ensure(): Promise<void> {
    const client = this.connection();
    if (!client.isOpen) await client.connect();
    await client.ping();
  }

  async write(input: MemoryStoreWriteInput): Promise<MemoryRecord> {
    await this.ensure();
    const client = this.connection();
    const record = recordFromWrite(input, new Date(), this.options);
    const key = recordKey(this.namespace, record.id);
    const value = JSON.stringify(record);
    if (input.ttlSeconds ?? this.options.defaultTtlSeconds) {
      await client.set(key, value, { EX: ttlForRedis(input, this.options) });
    } else {
      await client.set(key, value);
    }
    await client.sAdd(indexKey(this.namespace), key);
    return record;
  }

  async list(input: MemoryStoreListInput): Promise<MemoryRecord[]> {
    await this.ensure();
    const { expiredKeys, records, staleKeys } = await this.loadRecords();
    await this.deleteKeys([...expiredKeys, ...staleKeys]);
    const scoped = records
      .filter((record) => recordMatches(record, input))
      .sort(newestFirst);
    return input.limit === undefined ? scoped : scoped.slice(0, input.limit);
  }

  async close(): Promise<void> {
    if (!this.client?.isOpen) return;
    await this.client.quit();
  }

  private connection(): RedisConnection {
    if (!this.client) {
      const client = createClient({ url: this.options.redisUrl }) as unknown as RedisConnection;
      client.on?.("error", () => undefined);
      this.client = client;
    }
    return this.client;
  }

  private async loadRecords(now = new Date()): Promise<LoadedRecords> {
    const client = this.connection();
    const keys = await client.sMembers(indexKey(this.namespace));
    if (!keys.length) return { expiredKeys: [], records: [], staleKeys: [] };
    return recordsFromRedisValues(keys, await client.mGet(keys), now);
  }

  private async deleteKeys(keys: string[]): Promise<void> {
    if (!keys.length) return;
    const client = this.connection();
    await client.sRem(indexKey(this.namespace), keys);
    await client.del(keys);
  }
}

interface LoadedRecords {
  expiredKeys: string[];
  records: MemoryRecord[];
  staleKeys: string[];
}

function recordFromWrite(
  input: MemoryStoreWriteInput,
  now: Date,
  options: RedisRuntimeMemoryStoreOptions,
): MemoryRecord {
  const ttlSeconds = input.ttlSeconds ?? options.defaultTtlSeconds;
  return {
    id: input.id ?? `mem_${crypto.randomUUID()}`,
    scope: { ...input.scope },
    kind: input.kind,
    value: input.value,
    createdAt: now.toISOString(),
    expiresAt: expiresAt(now, ttlSeconds),
    metadata: input.metadata,
  };
}

function recordsFromRedisValues(
  keys: string[],
  values: Array<string | null>,
  now: Date,
): LoadedRecords {
  const expiredKeys: string[] = [];
  const records: MemoryRecord[] = [];
  const staleKeys: string[] = [];
  const time = now.getTime();
  values.forEach((value, index) => {
    const key = keys[index];
    if (!value) {
      staleKeys.push(key);
      return;
    }
    const record = JSON.parse(value) as MemoryRecord;
    if (record.expiresAt && Date.parse(record.expiresAt) <= time) {
      expiredKeys.push(key);
      return;
    }
    records.push(record);
  });
  return { expiredKeys, records, staleKeys };
}

function ttlForRedis(
  input: MemoryStoreWriteInput,
  options: RedisRuntimeMemoryStoreOptions,
): number {
  return Math.max(1, Math.floor(input.ttlSeconds ?? options.defaultTtlSeconds ?? 1));
}

function expiresAt(now: Date, ttlSeconds: number | undefined): string | undefined {
  if (!ttlSeconds || ttlSeconds <= 0) return undefined;
  return new Date(now.getTime() + ttlSeconds * 1000).toISOString();
}

function recordMatches(record: MemoryRecord, input: MemoryStoreListInput): boolean {
  return scopeMatches(record.scope, input.scope) &&
    (!input.kind || record.kind === input.kind);
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

function indexKey(namespace: string): string {
  return `${namespace}:runtime-memory:index`;
}

function recordKey(namespace: string, id: string): string {
  return `${namespace}:runtime-memory:record:${id}`;
}
