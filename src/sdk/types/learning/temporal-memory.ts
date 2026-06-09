import type { JsonValue } from "../json.js";

export interface TemporalMemoryScope {
  tenantId?: string;
  agentId?: string;
  userId?: string;
}

export interface TemporalMemoryRecord {
  id: string;
  scope: TemporalMemoryScope;
  kind: "fact" | "preference" | "failed_intent" | "missing_tool" | "summary";
  text: string;
  data?: JsonValue;
  sourceSessionId: string;
  createdAt: string;
  expiresAt?: string;
}

export interface TemporalMemoryWriteInput {
  scope: TemporalMemoryScope;
  records: Array<Omit<TemporalMemoryRecord, "id" | "scope" | "createdAt" | "expiresAt">>;
  ttlSeconds?: number;
}

export interface TemporalMemoryStorePort {
  isConfigured(): boolean;
  ensure?(): Promise<void> | void;
  write(input: TemporalMemoryWriteInput): Promise<TemporalMemoryRecord[]>;
  list(scope: TemporalMemoryScope): Promise<TemporalMemoryRecord[]>;
  deleteExpired?(now?: Date): Promise<number> | number;
}
