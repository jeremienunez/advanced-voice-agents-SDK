import type {
  ISessionStateMachine,
  SessionState,
  StateMachineConfig,
  StateMetadata,
  StateTransitionResult,
} from "../../types/session.types.js";
import { AgentError, ERROR_CODES } from "../../types/error.types.js";
import {
  getValidNextStates,
  isTerminal,
  isValidTransition,
  STATE_METADATA,
} from "./metadata.js";

export class SessionStateMachine implements ISessionStateMachine {
  private _state: SessionState;
  private _previous: SessionState | null = null;
  private readonly config: StateMachineConfig;

  constructor(config: StateMachineConfig) {
    this.config = config;
    this._state = config.initialState ?? "initializing";
  }

  get state(): SessionState {
    return this._state;
  }

  get previous(): SessionState | null {
    return this._previous;
  }

  get isTerminated(): boolean {
    return isTerminal(this._state);
  }

  get metadata(): StateMetadata {
    return STATE_METADATA[this._state];
  }

  transition(to: SessionState, reason?: string): StateTransitionResult {
    const from = this._state;

    if (this.isTerminated) {
      return {
        success: false,
        previousState: from,
        newState: from,
        reason: `Cannot transition from terminal state: ${from}`,
      };
    }

    if (from === to) {
      return {
        success: true,
        previousState: from,
        newState: to,
        reason: "Already in target state",
      };
    }

    if (!isValidTransition(from, to)) {
      return {
        success: false,
        previousState: from,
        newState: from,
        reason: `Invalid transition: ${from} -> ${to}`,
      };
    }

    this._previous = from;
    this._state = to;

    return {
      success: true,
      previousState: from,
      newState: to,
      reason,
    };
  }

  canTransitionTo(to: SessionState): boolean {
    if (this.isTerminated) return false;
    return isValidTransition(this._state, to);
  }

  getValidTransitions(): SessionState[] {
    if (this.isTerminated) return [];
    return getValidNextStates(this._state);
  }

  reset(initialState?: SessionState): void {
    this._state = initialState ?? "initializing";
    this._previous = null;
  }

  transitionOrThrow(to: SessionState, reason?: string): void {
    const result = this.transition(to, reason);
    if (!result.success) {
      throw new AgentError({
        code: ERROR_CODES.SESSION_INVALID_STATE,
        message: result.reason ?? `Failed to transition to ${to}`,
        context: {
          sessionId: this.config.sessionId,
          from: result.previousState,
          to,
        },
        recoverable: false,
      });
    }
  }
}

export function createStateMachine(
  config: StateMachineConfig,
): SessionStateMachine {
  return new SessionStateMachine(config);
}
