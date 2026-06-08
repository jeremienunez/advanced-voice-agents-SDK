import type { SessionState, StateMetadata } from "../../types/session.types.js";

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
