import type {
  TemporalMemoryRecord,
  TemporalMemoryScope,
  TemporalMemoryStorePort,
  TemporalMemoryWriteInput,
} from "@voiceagentsdk/core/sdk";
import { createClient } from "redis";
import { scopeMatches } from "./scope.js";
import type { RedisTemporalMemoryStoreOptions } from "./types.js";

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

export class RedisTemporalMemoryStore implements TemporalMemoryStorePort {
  private client?: RedisConnection;
  private readonly namespace: string;

  constructor(private readonly options: RedisTemporalMemoryStoreOptions) {
    this.namespace = options.namespace ?? "agent-learning";
  }

  isConfigured(): boolean {
    return Boolean(this.options.redisUrl);
  }

  async ensure(): Promise<void> {
    const client = this.connection();
    if (!client.isOpen) await client.connect();
    await client.ping();
  }

  async write(input: TemporalMemoryWriteInput): Promise<TemporalMemoryRecord[]> {
    await this.ensure();
    const client = this.connection();
    const now = new Date();
    const ttlSeconds = input.ttlSeconds ?? this.options.defaultTtlSeconds;
    const records = recordsForWrite(input, now, ttlSeconds);

    for (const record of records) {
      const key = recordKey(this.namespace, record.id);
      const value = JSON.stringify(record);
      if (ttlSeconds && ttlSeconds > 0) {
        await client.set(key, value, { EX: Math.max(1, Math.floor(ttlSeconds)) });
      } else {
        await client.set(key, value);
      }
      await client.sAdd(indexKey(this.namespace), key);
    }
    return records;
  }

  async list(scope: TemporalMemoryScope): Promise<TemporalMemoryRecord[]> {
    await this.ensure();
    const { records } = await this.loadRecords();
    return records.filter((record) => scopeMatches(record.scope, scope));
  }

  async deleteExpired(now: Date = new Date()): Promise<number> {
    await this.ensure();
    const { expiredKeys, staleKeys } = await this.loadRecords(now);
    const keys = [...expiredKeys, ...staleKeys];
    if (!keys.length) return 0;
    const client = this.connection();
    await client.sRem(indexKey(this.namespace), keys);
    await client.del(keys);
    return keys.length;
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

  private async loadRecords(now = new Date()): Promise<{
    expiredKeys: string[];
    records: TemporalMemoryRecord[];
    staleKeys: string[];
  }> {
    const client = this.connection();
    const keys = await client.sMembers(indexKey(this.namespace));
    if (!keys.length) return { expiredKeys: [], records: [], staleKeys: [] };
    const values = await client.mGet(keys);
    return recordsFromRedisValues(keys, values, now);
  }
}

function recordsForWrite(
  input: TemporalMemoryWriteInput,
  now: Date,
  ttlSeconds: number | undefined,
): TemporalMemoryRecord[] {
  const expiresAt = ttlSeconds
    ? new Date(now.getTime() + ttlSeconds * 1000).toISOString()
    : undefined;
  return input.records.map((record): TemporalMemoryRecord => ({
    ...record,
    id: `mem_${crypto.randomUUID()}`,
    scope: { ...input.scope },
    data: record.data,
    createdAt: now.toISOString(),
    expiresAt,
  }));
}

function recordsFromRedisValues(
  keys: string[],
  values: Array<string | null>,
  now: Date,
): {
  expiredKeys: string[];
  records: TemporalMemoryRecord[];
  staleKeys: string[];
} {
  const expiredKeys: string[] = [];
  const records: TemporalMemoryRecord[] = [];
  const staleKeys: string[] = [];
  const time = now.getTime();

  values.forEach((value, index) => {
    const key = keys[index];
    if (!value) {
      staleKeys.push(key);
      return;
    }
    const record = JSON.parse(value) as TemporalMemoryRecord;
    if (record.expiresAt && Date.parse(record.expiresAt) <= time) {
      expiredKeys.push(key);
      return;
    }
    records.push(record);
  });

  return { expiredKeys, records, staleKeys };
}

function indexKey(namespace: string): string {
  return `${namespace}:temporal-memory:index`;
}

function recordKey(namespace: string, id: string): string {
  return `${namespace}:temporal-memory:record:${id}`;
}
