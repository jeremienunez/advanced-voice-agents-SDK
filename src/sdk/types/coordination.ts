import type { JsonValue } from "./json.js";

export type AgentMailboxMessageStatus =
  | "queued"
  | "claimed"
  | "completed"
  | "failed"
  | "canceled";

export interface AgentMailboxAddress {
  agentId: string;
  userId?: string;
  endpoint?: string;
}

export type AgentMailboxMessagePart =
  | { kind: "text"; text: string; metadata?: Record<string, JsonValue> }
  | { kind: "data"; data: JsonValue; metadata?: Record<string, JsonValue> };

export interface AgentMailboxSendInput {
  tenantId: string;
  source: AgentMailboxAddress;
  target: AgentMailboxAddress;
  parts: readonly AgentMailboxMessagePart[];
  subject?: string;
  contextId?: string;
  taskId?: string;
  referenceTaskIds?: readonly string[];
  idempotencyKey?: string;
  metadata?: Record<string, JsonValue>;
}

export interface AgentMailboxMessage extends AgentMailboxSendInput {
  id: string;
  status: AgentMailboxMessageStatus;
  createdAt: string;
  updatedAt: string;
  claimedAt?: string;
  claimedBy?: string;
  leaseExpiresAt?: string;
  ackedAt?: string;
  failureReason?: string;
}

export interface AgentMailboxListInput {
  tenantId: string;
  targetAgentId?: string;
  sourceAgentId?: string;
  contextId?: string;
  status?: readonly AgentMailboxMessageStatus[];
  limit?: number;
}

export interface AgentMailboxClaimInput {
  tenantId: string;
  targetAgentId: string;
  workerId: string;
  leaseMs?: number;
  limit?: number;
}

export interface AgentMailboxAckInput {
  messageId: string;
  tenantId: string;
  targetAgentId?: string;
  status: Extract<AgentMailboxMessageStatus, "completed" | "failed" | "canceled">;
  reason?: string;
}

export interface AgentMailboxSubscribeInput {
  tenantId: string;
  targetAgentId?: string;
  contextId?: string;
}

export interface AgentMailboxPort {
  send(
    input: AgentMailboxSendInput,
  ): AgentMailboxMessage | Promise<AgentMailboxMessage>;
  list(
    input: AgentMailboxListInput,
  ): readonly AgentMailboxMessage[] | Promise<readonly AgentMailboxMessage[]>;
  claim(
    input: AgentMailboxClaimInput,
  ): readonly AgentMailboxMessage[] | Promise<readonly AgentMailboxMessage[]>;
  ack(input: AgentMailboxAckInput): AgentMailboxMessage | Promise<AgentMailboxMessage>;
  subscribe?(
    input: AgentMailboxSubscribeInput,
    handler: (message: AgentMailboxMessage) => void | Promise<void>,
  ): () => void;
}
