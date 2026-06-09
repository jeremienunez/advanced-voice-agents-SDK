import type { JsonObject } from "../json.js";

export interface GraphMemoryNode {
  id: string;
  type: string;
  label: string;
  properties?: JsonObject;
}

export interface GraphMemoryEdge {
  id: string;
  from: string;
  to: string;
  type: string;
  properties?: JsonObject;
}

export interface GraphMemoryUpsertInput {
  tenantId?: string;
  agentId?: string;
  userId?: string;
  sourceSessionId: string;
  nodes: GraphMemoryNode[];
  edges: GraphMemoryEdge[];
}

export interface GraphMemoryStorePort {
  isConfigured(): boolean;
  ensure?(): Promise<void> | void;
  upsert(input: GraphMemoryUpsertInput): Promise<{ nodeCount: number; edgeCount: number }>;
}
