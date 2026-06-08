import type {
  PendingToolCall,
  SessionContext,
} from "../types/session.types.js";

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
