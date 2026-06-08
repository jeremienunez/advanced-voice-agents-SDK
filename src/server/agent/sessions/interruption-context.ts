import type { SessionContext } from "../types/session.types.js";

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
