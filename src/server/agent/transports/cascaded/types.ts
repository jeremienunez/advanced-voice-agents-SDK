/**
 * Cascaded Transport Types — Pluggable MoE interfaces
 *
 * Three expert interfaces that compose into different modes:
 * - cascade:  WhisperSTT → TextChatLLM → OpenAITTS  (3 API calls)
 * - moe-stt:  (skip)     → AudioChatLLM → OpenAITTS  (2 API calls)
 * - moe-full: (skip)     → AudioChatLLM (audio out)   (1 API call)
 */

import type { AudioChunk } from "../../types/transport.types.js";

// =============================================================================
// Expert Interfaces
// =============================================================================

/** Speech-to-Text expert — converts audio buffer to text transcript */
export interface ISTT {
  transcribe(audio: Buffer, signal?: AbortSignal): Promise<string>;
}

/** LLM expert — streams text/audio responses with tool call support */
export interface ILLM {
  stream(
    messages: LlmMessage[],
    tools: LlmToolDefinition[],
    signal?: AbortSignal,
  ): AsyncGenerator<LlmStreamEvent>;
}

/** Text-to-Speech expert — streams audio chunks from text */
export interface ITTS {
  stream(text: string, signal?: AbortSignal): AsyncGenerator<AudioChunk>;
}

// =============================================================================
// LLM Message Types (supports text AND audio content)
// =============================================================================

export type LlmContentPart =
  | { type: "text"; text: string }
  | {
      type: "input_audio";
      input_audio: { data: string; format: "wav" | "pcm16" };
    };

export interface LlmMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | LlmContentPart[] | null;
  tool_calls?: LlmToolCall[];
  tool_call_id?: string;
}

export interface LlmToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

export interface LlmToolDefinition {
  type: "function";
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

// =============================================================================
// LLM Stream Events
// =============================================================================

export type LlmStreamEvent =
  | { type: "text_delta"; delta: string }
  | { type: "audio_delta"; chunk: AudioChunk }
  | {
      type: "tool_call_delta";
      index: number;
      callId?: string;
      name?: string;
      argsDelta: string;
    }
  | { type: "stream_done"; finishReason: "stop" | "tool_calls" };

// =============================================================================
// Cascaded Transport Config
// =============================================================================

export type CascadedMode = "cascade" | "moe-stt" | "moe-full";

export interface CascadedTransportConfig {
  apiKey: string;
  mode: CascadedMode;
  instructions?: string;
  tools?: LlmToolDefinition[];
  // STT (cascade mode only)
  sttModel?: string;
  sttLanguage?: string;
  // LLM
  llmModel?: string;
  llmTemperature?: number;
  llmMaxTokens?: number;
  // TTS (cascade + moe-stt modes)
  ttsModel?: string;
  ttsVoice?: string;
  ttsInstructions?: string;
  // VAD
  vadSilenceDurationMs?: number;
  vadSpeechThresholdRms?: number;
  vadConfirmationFrames?: number;
}
