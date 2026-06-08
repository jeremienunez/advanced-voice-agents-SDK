import type { SessionState } from "../../types/session.types.js";
import { STATE_METADATA } from "./session-state-metadata.js";

export function isTerminal(state: SessionState): boolean {
  return STATE_METADATA[state].isTerminal;
}

export function allowsInput(state: SessionState): boolean {
  return STATE_METADATA[state].allowsInput;
}

export function allowsOutput(state: SessionState): boolean {
  return STATE_METADATA[state].allowsOutput;
}
