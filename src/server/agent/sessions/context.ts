import type {
  PendingToolCall,
  SessionContext,
  SessionEndReason,
  SessionState,
  SessionSummary,
  VoiceSessionConfig,
} from "../types/index.js";

export function createSessionContext(
  config: VoiceSessionConfig,
): SessionContext {
  const now = Date.now();
  return {
    config,
    state: "initializing",
    startedAt: now,
    lastActivityAt: now,
    messageCount: 0,
    pendingToolCalls: new Map(),
    toolCallsCompleted: 0,
  };
}

export function updateActivity(ctx: SessionContext): SessionContext {
  return { ...ctx, lastActivityAt: Date.now() };
}

export function updateState(
  ctx: SessionContext,
  state: SessionState,
): SessionContext {
  return { ...ctx, state, lastActivityAt: Date.now() };
}

export function incrementMessageCount(ctx: SessionContext): SessionContext {
  return {
    ...ctx,
    messageCount: ctx.messageCount + 1,
    lastActivityAt: Date.now(),
  };
}

export function addPendingToolCall(
  ctx: SessionContext,
  call: PendingToolCall,
): SessionContext {
  const pendingToolCalls = new Map(ctx.pendingToolCalls);
  pendingToolCalls.set(call.callId, call);
  return { ...ctx, pendingToolCalls, lastActivityAt: Date.now() };
}

export function updatePendingToolCall(
  ctx: SessionContext,
  call: PendingToolCall,
): SessionContext {
  const pendingToolCalls = new Map(ctx.pendingToolCalls);
  pendingToolCalls.set(call.callId, call);
  return { ...ctx, pendingToolCalls, lastActivityAt: Date.now() };
}

export function finishPendingToolCall(
  ctx: SessionContext,
  call: PendingToolCall,
): SessionContext {
  const pendingToolCalls = new Map(ctx.pendingToolCalls);
  pendingToolCalls.delete(call.callId);
  return {
    ...ctx,
    pendingToolCalls,
    toolCallsCompleted: ctx.toolCallsCompleted + 1,
    lastActivityAt: Date.now(),
  };
}

export function clearAllPendingToolCalls(
  ctx: SessionContext,
): SessionContext {
  return {
    ...ctx,
    pendingToolCalls: new Map(),
    lastActivityAt: Date.now(),
  };
}

export function setInterrupted(ctx: SessionContext): SessionContext {
  return {
    ...ctx,
    state: "interrupted",
    interruptedAt: Date.now(),
    lastActivityAt: Date.now(),
  };
}

export function clearInterrupted(ctx: SessionContext): SessionContext {
  const { interruptedAt: _interruptedAt, ...rest } = ctx;
  return { ...rest, lastActivityAt: Date.now() };
}

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
