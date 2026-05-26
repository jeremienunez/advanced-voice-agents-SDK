import type { SessionState, StateMetadata } from "../../types/index.js";

export const STATE_TRANSITIONS: Record<SessionState, SessionState[]> = {
  initializing: ["connecting", "error"],
  connecting: ["authenticating", "active", "error"],
  authenticating: ["awaiting_pin", "active", "error", "auth_failed"],
  awaiting_pin: ["verifying_pin", "error", "auth_failed"],
  verifying_pin: ["active", "awaiting_pin", "error", "auth_failed"],
  active: [
    "listening",
    "speaking",
    "processing",
    "interrupted",
    "paused",
    "quota_warning",
    "ending",
    "error",
  ],
  listening: [
    "speaking",
    "processing",
    "interrupted",
    "active",
    "ending",
    "error",
  ],
  speaking: [
    "listening",
    "processing",
    "interrupted",
    "active",
    "ending",
    "error",
  ],
  processing: ["processing_tool", "speaking", "active", "error"],
  processing_tool: ["speaking", "active", "processing", "error"],
  interrupted: ["listening", "active", "ending", "error"],
  paused: ["active", "ending", "error"],
  quota_warning: ["active", "listening", "speaking", "ending", "error"],
  ending: ["ended", "error"],
  ended: [],
  error: ["ending", "fatal_error"],
  fatal_error: [],
  auth_failed: [],
};

export const STATE_METADATA: Record<SessionState, StateMetadata> = {
  initializing: {
    allowsInput: false,
    allowsOutput: false,
    isTerminal: false,
    description: "Session is being initialized",
  },
  connecting: {
    allowsInput: false,
    allowsOutput: false,
    isTerminal: false,
    description: "Connecting to transports",
  },
  authenticating: {
    allowsInput: false,
    allowsOutput: true,
    isTerminal: false,
    description: "Starting authentication flow",
  },
  awaiting_pin: {
    allowsInput: true,
    allowsOutput: true,
    isTerminal: false,
    description: "Waiting for PIN input",
  },
  verifying_pin: {
    allowsInput: false,
    allowsOutput: false,
    isTerminal: false,
    description: "Verifying PIN",
  },
  active: {
    allowsInput: true,
    allowsOutput: true,
    isTerminal: false,
    description: "Session is active and ready",
  },
  listening: {
    allowsInput: true,
    allowsOutput: false,
    isTerminal: false,
    description: "Listening for user input",
  },
  speaking: {
    allowsInput: true,
    allowsOutput: true,
    isTerminal: false,
    description: "Agent is speaking",
  },
  processing: {
    allowsInput: false,
    allowsOutput: false,
    isTerminal: false,
    description: "Processing user request",
  },
  processing_tool: {
    allowsInput: false,
    allowsOutput: false,
    isTerminal: false,
    description: "Executing tool call",
  },
  interrupted: {
    allowsInput: true,
    allowsOutput: false,
    isTerminal: false,
    description: "User interrupted agent",
  },
  paused: {
    allowsInput: false,
    allowsOutput: false,
    isTerminal: false,
    description: "Session is paused",
  },
  quota_warning: {
    allowsInput: true,
    allowsOutput: true,
    isTerminal: false,
    description: "Quota warning issued",
  },
  ending: {
    allowsInput: false,
    allowsOutput: true,
    isTerminal: false,
    description: "Session is ending",
  },
  ended: {
    allowsInput: false,
    allowsOutput: false,
    isTerminal: true,
    description: "Session has ended",
  },
  error: {
    allowsInput: false,
    allowsOutput: true,
    isTerminal: false,
    description: "Recoverable error occurred",
  },
  fatal_error: {
    allowsInput: false,
    allowsOutput: false,
    isTerminal: true,
    description: "Fatal error - session terminated",
  },
  auth_failed: {
    allowsInput: false,
    allowsOutput: false,
    isTerminal: true,
    description: "Authentication failed",
  },
};

export function isValidTransition(
  from: SessionState,
  to: SessionState,
): boolean {
  return STATE_TRANSITIONS[from].includes(to);
}

export function getValidNextStates(state: SessionState): SessionState[] {
  return [...STATE_TRANSITIONS[state]];
}

export function isTerminal(state: SessionState): boolean {
  return STATE_METADATA[state].isTerminal;
}

export function allowsInput(state: SessionState): boolean {
  return STATE_METADATA[state].allowsInput;
}

export function allowsOutput(state: SessionState): boolean {
  return STATE_METADATA[state].allowsOutput;
}
