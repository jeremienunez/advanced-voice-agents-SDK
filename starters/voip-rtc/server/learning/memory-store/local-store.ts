import type {
  TemporalMemoryRecord,
  TemporalMemoryScope,
  TemporalMemoryStorePort,
  TemporalMemoryWriteInput,
} from "@voiceagentsdk/core/sdk";
import { scopeMatches } from "./scope.js";
import type { TemporalMemoryStoreOptions } from "./types.js";

export class LocalRedisTemporalMemoryStore implements TemporalMemoryStorePort {
  private readonly records = new Map<string, TemporalMemoryRecord>();
  private ensured = false;

  constructor(
    private readonly options: TemporalMemoryStoreOptions = {},
  ) {}

  isConfigured(): boolean {
    return true;
  }

  ensure(): void {
    this.ensured = true;
  }

  async write(input: TemporalMemoryWriteInput): Promise<TemporalMemoryRecord[]> {
    if (!this.ensured) this.ensure();
    const now = new Date();
    const ttlSeconds = input.ttlSeconds ?? this.options.defaultTtlSeconds;
    const expiresAt = ttlSeconds
      ? new Date(now.getTime() + ttlSeconds * 1000).toISOString()
      : undefined;
    const records = input.records.map((record): TemporalMemoryRecord => {
      return {
        ...record,
        id: `mem_${crypto.randomUUID()}`,
        scope: { ...input.scope },
        data: record.data,
        createdAt: now.toISOString(),
        expiresAt,
      };
    });
    for (const record of records) this.records.set(record.id, record);
    await this.deleteExpired(now);
    return records;
  }

  async list(scope: TemporalMemoryScope): Promise<TemporalMemoryRecord[]> {
    await this.deleteExpired();
    return Array.from(this.records.values()).filter((record) => {
      return scopeMatches(record.scope, scope);
    });
  }

  deleteExpired(now: Date = new Date()): number {
    let deleted = 0;
    const time = now.getTime();
    for (const [id, record] of this.records.entries()) {
      if (record.expiresAt && Date.parse(record.expiresAt) <= time) {
        this.records.delete(id);
        deleted++;
      }
    }
    return deleted;
  }
}
