import type { JsonValue } from "../../../sdk/types/json.js";

export class A2AProtocolError extends Error {
  constructor(
    readonly code: number,
    message: string,
    readonly data?: JsonValue,
  ) {
    super(message);
  }
}

export function taskNotFound(taskId: string): A2AProtocolError {
  return new A2AProtocolError(-32001, "Task not found", errorInfo(
    "TASK_NOT_FOUND",
    { taskId },
  ));
}

export function taskNotCancelable(taskId: string): A2AProtocolError {
  return new A2AProtocolError(-32002, "Task not cancelable", errorInfo(
    "TASK_NOT_CANCELABLE",
    { taskId },
  ));
}

export function isTerminalA2ATaskState(state: string): boolean {
  return state === "TASK_STATE_COMPLETED" ||
    state === "TASK_STATE_FAILED" ||
    state === "TASK_STATE_CANCELED" ||
    state === "TASK_STATE_REJECTED";
}

function errorInfo(
  reason: string,
  metadata: Record<string, string>,
): JsonValue {
  return [{
    "@type": "type.googleapis.com/google.rpc.ErrorInfo",
    reason,
    domain: "a2a-protocol.org",
    metadata,
  }];
}
