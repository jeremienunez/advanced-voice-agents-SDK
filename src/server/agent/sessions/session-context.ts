import type {
  SessionContext,
  SessionState,
  VoiceSessionConfig,
} from "../types/session.types.js";

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
