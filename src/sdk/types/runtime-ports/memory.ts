import type { TenantId } from "../core/index.js";

export interface MemoryScope {
  tenantId: TenantId;
  userId?: string;
  sessionId?: string;
  agentId?: string;
}

export interface MemoryRecord {
  id: string;
  scope: MemoryScope;
  kind: string;
  value: unknown;
  createdAt: string;
  updatedAt?: string;
  expiresAt?: string;
  metadata?: Record<string, unknown>;
}

export interface MemoryStoreWriteInput {
  scope: MemoryScope;
  kind: string;
  value: unknown;
  id?: string;
  ttlSeconds?: number;
  metadata?: Record<string, unknown>;
}

export interface MemoryStoreListInput {
  scope: MemoryScope;
  kind?: string;
  limit?: number;
}

export interface MemoryStoreDeleteInput {
  id?: string;
  scope?: MemoryScope;
  kind?: string;
}

export interface MemoryStorePort {
  isConfigured?(): boolean;
  ensure?(): void | Promise<void>;
  write(input: MemoryStoreWriteInput): MemoryRecord | Promise<MemoryRecord>;
  list(input: MemoryStoreListInput): readonly MemoryRecord[] | Promise<readonly MemoryRecord[]>;
  delete?(input: MemoryStoreDeleteInput): number | Promise<number>;
}
