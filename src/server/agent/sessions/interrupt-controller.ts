/**
 * Interrupt Controller - Barge-in detection and recovery
 * Extracted from VoiceSession to handle response interruption logic
 */

import type { IRealtimeProvider } from "../types/index.js";
import type { SessionStateMachine } from "./state-machine.js";
import type { SessionContext } from "../types/index.js";
import { setInterrupted, clearInterrupted, updateState } from "./context.js";
import { createAgentLogger } from "../utils/index.js";

// ============================================================================
// Types
// ============================================================================

export interface InterruptControllerDeps {
  getTransport: () => IRealtimeProvider | null;
  getStateMachine: () => SessionStateMachine;
  getContext: () => SessionContext;
  setContext: (ctx: SessionContext) => void;
  onStateChange?: (state: SessionContext["state"]) => void;
  /** Called on interrupt — used to clear Twilio audio buffer */
  onInterrupted?: () => void;
}

// ============================================================================
// Interrupt Controller
// ============================================================================

export class InterruptController {
  private recoveryTimer: ReturnType<typeof setTimeout> | null = null;
  private logger = createAgentLogger("InterruptController");

  constructor(private readonly deps: InterruptControllerDeps) {}

  /**
   * Interrupt the current response (barge-in)
   */
  interrupt(): void {
    const transport = this.deps.getTransport();
    const sm = this.deps.getStateMachine();

    if (!transport || sm.isTerminated) {
      return;
    }

    this.logger.info("Interrupting response");

    try {
      // Cancel the in-flight response
      // Note: interrupt_response: true in VAD config means OpenAI handles
      // truncation server-side. Manual truncation (A1) caused errors because
      // lastSpeechEndMs is the INPUT audio position, not OUTPUT audio position.
      transport.cancelResponse();

      // Clear Twilio audio buffer so buffered audio stops playing immediately
      this.deps.onInterrupted?.();

      this.deps.setContext(setInterrupted(this.deps.getContext()));
      this.transitionTo("interrupted");

      // Clear interrupted and go back to listening after recovery delay
      this.recoveryTimer = setTimeout(() => {
        if (this.deps.getStateMachine().state === "interrupted") {
          this.deps.setContext(clearInterrupted(this.deps.getContext()));
          this.transitionTo("listening");
        }
        this.recoveryTimer = null;
      }, 100);
    } catch (error) {
      this.logger.error("Error interrupting", { error });
    }
  }

  /**
   * Check if currently recovering from an interruption
   */
  isRecovering(): boolean {
    return this.recoveryTimer !== null;
  }

  /**
   * Reset the controller, clearing any pending recovery timer
   */
  reset(): void {
    if (this.recoveryTimer) {
      clearTimeout(this.recoveryTimer);
      this.recoveryTimer = null;
    }
  }

  private transitionTo(state: SessionContext["state"]): void {
    const sm = this.deps.getStateMachine();
    const result = sm.transition(state);
    if (result.success && result.previousState !== result.newState) {
      this.deps.setContext(updateState(this.deps.getContext(), state));
      this.deps.onStateChange?.(state);
    }
  }
}

// ============================================================================
// Factory
// ============================================================================

export function createInterruptController(
  deps: InterruptControllerDeps,
): InterruptController {
  return new InterruptController(deps);
}
