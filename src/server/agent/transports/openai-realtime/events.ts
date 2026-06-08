import type { RawData } from "ws";
import type { AgentLogger } from "../../utils/logger.js";
import type {
  OpenAIApiError,
  OpenAIFunctionCall,
  OpenAIServerEvent,
} from "../../types/openai.types.js";
import type { AudioBuffer } from "../openai-audio.js";
import {
  createAudioChunk,
  decodeAudioFromOpenAI,
} from "../openai-audio.js";
import type { OpenAIEventHandlers } from "./types.js";

export interface OpenAIRealtimeEventState {
  sessionId: string | null;
  currentResponseId: string | null;
  currentItemId: string | null;
  lastAudioEndMs: number | null;
  audioBuffer: AudioBuffer;
  functionCallArgs: Map<string, string>;
  handlers: OpenAIEventHandlers;
  logger: AgentLogger;
  appendOutputAudio?: (chunk: Buffer) => void;
}

export function handleOpenAIRealtimeMessage(
  data: RawData,
  state: OpenAIRealtimeEventState,
): OpenAIServerEvent | null {
  try {
    const raw = JSON.parse(data.toString()) as Record<string, unknown>;
    const event = raw as OpenAIServerEvent;

    switch (event.type) {
      case "session.created":
        state.sessionId = (raw.session as { id: string })?.id ?? null;
        break;
      case "session.updated":
        handleSessionUpdated(raw, state);
        break;
      case "response.output_audio.delta":
      case "response.audio.delta":
        handleAudioDelta(raw, state);
        break;
      case "response.function_call_arguments.delta":
        handleFunctionCallDelta(raw, state);
        break;
      case "response.function_call_arguments.done":
        handleFunctionCallDone(raw, state);
        break;
      case "input_audio_buffer.speech_started":
        state.logger.info("VAD speech_started");
        state.handlers.onSpeechStarted?.();
        break;
      case "input_audio_buffer.speech_stopped":
        state.lastAudioEndMs = (raw.audio_end_ms as number) ?? null;
        state.logger.info("VAD speech_stopped", {
          audioEndMs: state.lastAudioEndMs,
        });
        state.handlers.onSpeechStopped?.(
          raw.audio_end_ms as number | undefined,
        );
        break;
      case "input_audio_buffer.committed":
        state.logger.info("Audio buffer committed", { item_id: raw.item_id });
        break;
      case "response.created":
        handleResponseCreated(raw, state);
        break;
      case "response.output_item.added":
        handleOutputItemAdded(raw, state);
        break;
      case "response.done":
        handleResponseDone(raw, state);
        break;
      case "conversation.item.input_audio_transcription.completed":
        state.handlers.onTranscript?.(raw.transcript as string, true);
        break;
      case "error":
        handleError(raw, state);
        break;
    }
    return event;
  } catch {
    return null;
  }
}

function handleSessionUpdated(
  raw: Record<string, unknown>,
  state: OpenAIRealtimeEventState,
): void {
  const sess = raw.session as Record<string, unknown> | undefined;
  const audio = sess?.audio as Record<string, unknown> | undefined;
  state.logger.info("Session updated - audio config accepted", {
    input: audio?.input,
    output: audio?.output,
  });
}

function handleAudioDelta(
  raw: Record<string, unknown>,
  state: OpenAIRealtimeEventState,
): void {
  const delta = raw.delta as string;
  if (!delta) return;
  const audioData = decodeAudioFromOpenAI(delta);
  state.appendOutputAudio?.(audioData);
  const chunk = createAudioChunk(
    audioData,
    "pcm16",
    state.audioBuffer.nextSequence(),
  );
  state.handlers.onAudio?.(chunk);
}

function handleFunctionCallDelta(
  raw: Record<string, unknown>,
  state: OpenAIRealtimeEventState,
): void {
  const callId = raw.call_id as string;
  const delta = raw.delta as string;
  if (callId && delta) {
    state.functionCallArgs.set(
      callId,
      (state.functionCallArgs.get(callId) ?? "") + delta,
    );
  }
}

function handleFunctionCallDone(
  raw: Record<string, unknown>,
  state: OpenAIRealtimeEventState,
): void {
  const callId = raw.call_id as string;
  const name = raw.name as string;
  const args = raw.arguments as string;
  if (callId && name) {
    state.functionCallArgs.delete(callId);
    const call: OpenAIFunctionCall = {
      call_id: callId,
      name,
      arguments: args ?? "{}",
    };
    state.handlers.onFunctionCall?.(call);
  }
}

function handleResponseCreated(
  raw: Record<string, unknown>,
  state: OpenAIRealtimeEventState,
): void {
  state.currentResponseId = (raw.response as { id: string })?.id ?? null;
  state.logger.info("Response created", {
    responseId: state.currentResponseId,
  });
  if (state.currentResponseId) {
    state.handlers.onResponseStarted?.(state.currentResponseId);
  }
}

function handleOutputItemAdded(
  raw: Record<string, unknown>,
  state: OpenAIRealtimeEventState,
): void {
  state.currentItemId = (raw.item as { id: string })?.id ?? null;
  const itemType = (raw.item as { type?: string })?.type;
  state.logger.info("Output item added", {
    itemId: state.currentItemId,
    type: itemType,
  });
}

function handleResponseDone(
  raw: Record<string, unknown>,
  state: OpenAIRealtimeEventState,
): void {
  const respObj = raw.response as Record<string, unknown> | undefined;
  const respStatus = respObj?.status as string | undefined;
  const responseId =
    (respObj?.id as string | undefined) ?? state.currentResponseId;
  const phase = respObj?.phase as string | undefined;
  const usage = respObj?.usage;
  state.logger.info("Response done", {
    responseId,
    status: respStatus,
    phase,
    usage,
  });
  state.handlers.onResponseDone?.({
    responseId,
    status: respStatus,
    phase,
    usage,
  });
  if (responseId) {
    if (respStatus === "cancelled") {
      state.handlers.onResponseCancelled?.(responseId);
    }
    state.handlers.onResponseCompleted?.(responseId);
  }
}

function handleError(
  raw: Record<string, unknown>,
  state: OpenAIRealtimeEventState,
): void {
  const errorObj = raw.error as Record<string, unknown> | undefined;
  const apiError: OpenAIApiError = {
    type: "error",
    error: {
      type: (errorObj?.type as string) ?? "unknown_error",
      code: (errorObj?.code as string) ?? "unknown",
      message: (errorObj?.message as string) ?? JSON.stringify(raw),
    },
  };
  state.handlers.onError?.(apiError);
}
