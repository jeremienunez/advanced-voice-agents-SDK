/**
 * Audio Pipeline - Audio I/O routing for voice sessions
 * Extracted from VoiceSession to handle audio input/output delegation
 */

import type { IRealtimeProvider } from "../types/index.js";
import type { SessionStateMachine } from "./state-machine.js";
import type { SessionContext } from "../types/index.js";
import { updateActivity } from "./context.js";
import { createAgentLogger } from "../utils/index.js";

// ============================================================================
// Types
// ============================================================================

export interface AudioPipelineDeps {
  getTransport: () => IRealtimeProvider | null;
  getStateMachine: () => SessionStateMachine;
  getContext: () => SessionContext;
  setContext: (ctx: SessionContext) => void;
}

// ============================================================================
// Audio Pipeline
// ============================================================================

export class AudioPipeline {
  private logger = createAgentLogger("AudioPipeline");

  constructor(private readonly deps: AudioPipelineDeps) {}

  /**
   * Send an audio chunk from Twilio to OpenAI
   */
  sendAudio(chunk: Buffer): void {
    const transport = this.deps.getTransport();
    const sm = this.deps.getStateMachine();

    if (!transport || sm.isTerminated) {
      return;
    }

    // Only accept audio in states that allow input
    if (!sm.metadata.allowsInput) {
      return;
    }

    try {
      transport.sendAudio({
        payload: chunk,
        encoding: "pcm16",
        sampleRate: 24000,
        channels: 1,
        timestamp: Date.now(),
      });

      this.deps.setContext(updateActivity(this.deps.getContext()));
    } catch (error) {
      this.logger.error("Error sending audio", { error });
    }
  }
}

// ============================================================================
// Factory
// ============================================================================

export function createAudioPipeline(deps: AudioPipelineDeps): AudioPipeline {
  return new AudioPipeline(deps);
}
