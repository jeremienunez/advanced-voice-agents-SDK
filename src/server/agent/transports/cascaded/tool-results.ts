import type { AgentLogger } from "../../utils/logger.js";

const DEFAULT_TOOL_RESULT_TIMEOUT_MS = 120_000;

export interface CascadedToolResultState {
  pendingToolResults: Map<string, (result: unknown) => void>;
  toolResultTimeoutMs?: number;
  logger: Pick<AgentLogger, "warn">;
}

export function submitCascadedToolResult(
  state: CascadedToolResultState,
  callId: string,
  result: unknown,
): boolean {
  const resolver = state.pendingToolResults.get(callId);
  if (!resolver) return false;
  resolver(result);
  state.pendingToolResults.delete(callId);
  return true;
}

export function cancelPendingToolResults(state: CascadedToolResultState): void {
  for (const [, resolver] of state.pendingToolResults) {
    resolver({ error: "cancelled" });
  }
  state.pendingToolResults.clear();
}

export function waitForToolResult(
  state: CascadedToolResultState,
  callId: string,
): Promise<unknown> {
  return new Promise((resolve) => {
    const timeoutMs = toolResultTimeoutMs(state);
    let timeout: ReturnType<typeof setTimeout> | null = setTimeout(() => {
      timeout = null;
      if (!state.pendingToolResults.has(callId)) return;
      state.pendingToolResults.delete(callId);
      state.logger.warn("Tool result timed out", { callId, timeoutMs });
      resolve({
        error: "tool_result_timeout",
        message: `Tool result for "${callId}" timed out after ${timeoutMs}ms.`,
      });
    }, timeoutMs);

    state.pendingToolResults.set(callId, (result) => {
      if (timeout) {
        clearTimeout(timeout);
        timeout = null;
      }
      resolve(result);
    });
  });
}

function toolResultTimeoutMs(state: CascadedToolResultState): number {
  const timeoutMs = state.toolResultTimeoutMs;
  if (!Number.isFinite(timeoutMs) || !timeoutMs || timeoutMs < 1) {
    return DEFAULT_TOOL_RESULT_TIMEOUT_MS;
  }
  return timeoutMs;
}
