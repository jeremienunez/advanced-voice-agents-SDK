import type { RawData } from "ws";
import { GROK_DEFAULT_SAMPLE_RATE, GROK_EVENTS } from "../../types/grok.types.js";
import type { AudioChunk } from "../../types/transport.types.js";
import { decodeAudioBase64 } from "../../utils/audio.js";
import type { AgentLogger } from "../../utils/logger.js";
import type {
  GrokRealtimeConfig,
  GrokRealtimeHandlers,
} from "./types.js";

export interface GrokRealtimeEventState {
  lastSpeechEndMs: number | null;
  currentResponseItemId: string | null;
  audioSeq: number;
  config: GrokRealtimeConfig;
  handlers: GrokRealtimeHandlers;
  logger: AgentLogger;
}

export function handleGrokRealtimeMessage(
  data: RawData,
  state: GrokRealtimeEventState,
): void {
  let msg: Record<string, unknown>;
  try {
    msg = JSON.parse(data.toString()) as Record<string, unknown>;
  } catch {
    state.logger.warn("Failed to parse Grok message");
    return;
  }

  const type = msg.type as string;
  if (!type) return;

  switch (type) {
    case GROK_EVENTS.AUDIO_DELTA:
      handleAudioDelta(msg, state);
      break;
    case GROK_EVENTS.TRANSCRIPT_DELTA:
      /* response transcript stream — the model speaking */
      state.handlers.onTranscript?.(msg.delta as string, false, "assistant");
      break;
    case GROK_EVENTS.TRANSCRIPT_DONE:
      state.handlers.onTranscript?.(msg.transcript as string, true, "assistant");
      break;
    case GROK_EVENTS.SPEECH_STARTED:
      state.handlers.onSpeechStarted?.();
      break;
    case GROK_EVENTS.SPEECH_STOPPED:
      state.lastSpeechEndMs = (msg.audio_end_ms as number) ?? null;
      state.handlers.onSpeechStopped?.(state.lastSpeechEndMs ?? undefined);
      break;
    case GROK_EVENTS.RESPONSE_CREATED:
      handleResponseCreated(msg, state);
      break;
    case GROK_EVENTS.RESPONSE_DONE:
      handleResponseDone(msg, state);
      break;
    case GROK_EVENTS.FUNCTION_CALL_DONE:
      state.handlers.onFunctionCall?.({
        callId: msg.call_id as string,
        name: msg.name as string,
        arguments: msg.arguments as string,
      });
      break;
    case "error":
      handleError(msg, state);
      break;
    default:
      break;
  }
}

function handleAudioDelta(
  msg: Record<string, unknown>,
  state: GrokRealtimeEventState,
): void {
  const delta = msg.delta as string | undefined;
  if (!delta) return;

  if (msg.item_id) {
    state.currentResponseItemId = msg.item_id as string;
  }

  const audioData = decodeAudioBase64(delta);
  const chunk: AudioChunk = {
    payload: audioData,
    encoding: "pcm16",
    sampleRate: state.config.audioFormat?.rate ?? GROK_DEFAULT_SAMPLE_RATE,
    channels: 1,
    timestamp: Date.now(),
    sequenceNumber: state.audioSeq++,
  };
  state.handlers.onAudio?.(chunk);
}

function handleResponseCreated(
  msg: Record<string, unknown>,
  state: GrokRealtimeEventState,
): void {
  const response = msg.response as Record<string, unknown> | undefined;
  const responseId = (response?.id as string) ?? `grok-${Date.now()}`;
  state.handlers.onResponseStarted?.(responseId);
}

function handleResponseDone(
  msg: Record<string, unknown>,
  state: GrokRealtimeEventState,
): void {
  const response = msg.response as Record<string, unknown> | undefined;
  const responseId = (response?.id as string) ?? `grok-${Date.now()}`;
  state.currentResponseItemId = null;
  state.handlers.onResponseCompleted?.(responseId);
}

function handleError(
  msg: Record<string, unknown>,
  state: GrokRealtimeEventState,
): void {
  const error = msg.error as Record<string, unknown> | undefined;
  state.logger.error("xAI error received", {
    rawError: JSON.stringify(error),
    eventId: msg.event_id,
  });
  state.handlers.onError?.({
    code: (error?.code as string) ?? "unknown",
    message: (error?.message as string) ?? "Unknown Grok error",
    type: (error?.type as string) ?? "error",
  });
}
