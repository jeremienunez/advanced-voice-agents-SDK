import type { JsonObject } from "../json.js";

export interface LearningSessionSummary {
  sessionId: string;
  tenantId?: string;
  userId?: string;
  channel: string;
  startedAt: number;
  endedAt: number;
  durationMs: number;
  messageCount: number;
  toolCallCount: number;
  endReason: string;
}

export interface LearningTranscriptEntry {
  role: "user" | "assistant" | "tool" | string;
  text: string;
  isFinal: boolean;
  timestamp: number;
}

export interface LearningToolCallRecord {
  callId: string;
  toolName: string;
  arguments: Record<string, unknown>;
  status: "pending" | "executing" | "completed" | "failed" | string;
  startedAt: number;
  completedAt?: number;
  result?: unknown;
  error?: string;
}

export interface LearningSessionInput {
  runId?: string;
  agentId?: string;
  draftId?: string;
  tenantId?: string;
  userId?: string;
  summary: LearningSessionSummary;
  transcript: LearningTranscriptEntry[];
  toolCalls: LearningToolCallRecord[];
  metadata?: JsonObject;
}
