import type { SessionState } from "../../types/index.js";
import { STATE_TRANSITIONS } from "./state-transition-table.js";

export function isValidTransition(
  from: SessionState,
  to: SessionState,
): boolean {
  return STATE_TRANSITIONS[from].includes(to);
}

export function getValidNextStates(state: SessionState): SessionState[] {
  return [...STATE_TRANSITIONS[state]];
}
