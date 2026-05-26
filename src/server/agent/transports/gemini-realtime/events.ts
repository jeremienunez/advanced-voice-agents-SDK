import type { AgentLogger } from "../../utils/index.js";
import type { AudioBuffer } from "../../utils/audio.js";
import {
  decodeAudioBase64,
} from "../../utils/audio.js";
import type {
  AudioChunk,
} from "../../types/transport.types.js";
import type {
  GeminiPart,
  GeminiServerContent,
  GeminiServerMessage,
  GeminiToolCallCancellation,
  GeminiToolCallMessage,
} from "../../types/gemini.types.js";
import { GEMINI_OUTPUT_SAMPLE_RATE } from "../../types/gemini.types.js";
import type { GeminiRealtimeHandlers } from "./types.js";

export interface GeminiRealtimeEventState {
  audioBuffer: AudioBuffer;
  currentResponseId: string | null;
  currentItemId: string | null;
  lastAudioEndMs: number | null;
  responseStarted: boolean;
  handlers: GeminiRealtimeHandlers;
  logger: AgentLogger;
}

export function handleGeminiServerMessage(
  msg: GeminiServerMessage,
  state: GeminiRealtimeEventState,
): void {
  if ("serverContent" in msg) {
    handleServerContent(msg, state);
  } else if ("toolCall" in msg) {
    handleToolCall(msg, state);
  } else if ("toolCallCancellation" in msg) {
    handleToolCallCancellation(msg, state);
  } else if ("goAway" in msg) {
    state.logger.warn("Gemini GoAway received - session ending");
    state.handlers.onError?.({
      code: "go_away",
      message: "Gemini is disconnecting the session",
      type: "session_limit",
    });
  }
}

function handleServerContent(
  msg: GeminiServerContent,
  state: GeminiRealtimeEventState,
): void {
  const content = msg.serverContent;

  if (content.interrupted) {
    state.logger.info("Response interrupted by user barge-in");
    if (state.currentResponseId) {
      state.handlers.onResponseCompleted?.(state.currentResponseId);
    }
    state.responseStarted = false;
    return;
  }

  if (content.modelTurn?.parts) {
    for (const part of content.modelTurn.parts) {
      handlePart(part, state);
    }
  }

  if (
    content.turnComplete ||
    (content as Record<string, unknown>).generationComplete
  ) {
    const responseId = state.currentResponseId ?? `gemini-${Date.now()}`;
    state.handlers.onResponseCompleted?.(responseId);
    state.responseStarted = false;
    state.currentResponseId = null;
  }
}

function handlePart(
  part: GeminiPart,
  state: GeminiRealtimeEventState,
): void {
  if (part.inlineData?.data) {
    if (!state.responseStarted) {
      state.responseStarted = true;
      state.currentResponseId = `gemini-${Date.now()}`;
      state.currentItemId = state.currentResponseId;
      state.handlers.onResponseStarted?.(state.currentResponseId);
    }

    const audioData = decodeAudioBase64(part.inlineData.data);
    const chunk: AudioChunk = {
      payload: audioData,
      encoding: "pcm16",
      sampleRate: GEMINI_OUTPUT_SAMPLE_RATE,
      channels: 1,
      timestamp: Date.now(),
      sequenceNumber: state.audioBuffer.nextSequence(),
    };
    state.handlers.onAudio?.(chunk);
  }

  if (part.text) {
    state.handlers.onTranscript?.(part.text, false);
  }
}

function handleToolCall(
  msg: GeminiToolCallMessage,
  state: GeminiRealtimeEventState,
): void {
  for (const fn of msg.toolCall.functionCalls) {
    state.handlers.onFunctionCall?.({
      callId: fn.id,
      name: fn.name,
      arguments: JSON.stringify(fn.args),
    });
  }
}

function handleToolCallCancellation(
  msg: GeminiToolCallCancellation,
  state: GeminiRealtimeEventState,
): void {
  state.logger.info("Tool call cancelled", {
    ids: msg.toolCallCancellation.ids,
  });
}
