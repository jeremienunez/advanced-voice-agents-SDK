import type {
  SessionContext,
  SessionEndReason,
  SessionSummary,
} from "../types/index.js";

export function createSessionSummary(
  ctx: SessionContext,
  reason: SessionEndReason,
): SessionSummary {
  const endedAt = Date.now();
  return {
    sessionId: ctx.config.sessionId,
    tenantId: ctx.config.tenantId,
    userId: ctx.config.userId,
    channel: ctx.config.channel,
    startedAt: ctx.startedAt,
    endedAt,
    durationMs: endedAt - ctx.startedAt,
    messageCount: ctx.messageCount,
    toolCallCount: ctx.toolCallsCompleted,
    endReason: reason,
  };
}
