/**
 * Gemini Types - Live API (native audio) types and configurations
 * Model: gemini-3.1-flash-live-preview
 *
 * Input: PCM 16kHz 16-bit, MIME audio/pcm;rate=16000
 * Output: PCM 24kHz 16-bit
 */

// Available Chirp 3 voices
export type GeminiVoice =
  | "Puck"
  | "Charon"
  | "Kore"
  | "Fenrir"
  | "Aoede"
  | "Leda"
  | "Orus"
  | "Zephyr";

// Model identifiers (native audio variants)
export type GeminiRealtimeModel =
  | "gemini-3.1-flash-live-preview"
  | "gemini-2.5-flash-native-audio-preview-12-2025"
  | "gemini-2.5-flash-exp-native-audio-thinking-dialog";

// Audio constants
export const GEMINI_INPUT_SAMPLE_RATE = 16000;
export const GEMINI_OUTPUT_SAMPLE_RATE = 24000;
export const GEMINI_INPUT_MIME = "audio/pcm;rate=16000" as const;

// ============================================================================
// Client → Server messages
// ============================================================================

/** First message to establish session config (immutable once sent) */
export interface GeminiSetupMessage {
  setup: {
    model: string;
    generationConfig: GeminiGenerationConfig;
    systemInstruction?: { parts: Array<{ text: string }> };
    tools?: Array<{ functionDeclarations: GeminiFunctionDeclaration[] }>;
  };
}

export interface GeminiGenerationConfig {
  responseModalities: ("AUDIO" | "TEXT")[];
  speechConfig?: {
    voiceConfig: {
      prebuiltVoiceConfig: { voiceName: string };
    };
  };
  thinkingConfig?: {
    thinkingBudget?: number;
    thinkingLevel?: "minimal" | "low" | "medium" | "high";
  };
  temperature?: number;
  topP?: number;
  topK?: number;
  maxOutputTokens?: number;
}

export interface GeminiFunctionDeclaration {
  name: string;
  description: string;
  parameters: Record<string, unknown>; // JSON Schema
}

/** Send audio input in real-time */
export interface GeminiRealtimeInput {
  realtimeInput: {
    audio?: {
      data: string; // base64 PCM
      mimeType: typeof GEMINI_INPUT_MIME;
    };
    text?: string;
    /**
     * Deprecated by Gemini Live. Kept only to type legacy responses/code while
     * the transport sends `audio` for current models.
     */
    mediaChunks?: Array<{
      data: string;
      mimeType: typeof GEMINI_INPUT_MIME;
    }>;
  };
}

/** Send text or turn-complete signal */
export interface GeminiClientContent {
  clientContent: {
    turns?: Array<{
      role: "user";
      parts: Array<{ text: string }>;
    }>;
    turnComplete: boolean;
  };
}

/** Return tool execution results */
export interface GeminiToolResponse {
  toolResponse: {
    functionResponses: Array<{
      id: string;
      name: string;
      response: Record<string, unknown>;
    }>;
  };
}

// ============================================================================
// Server → Client messages
// ============================================================================

/** Setup acknowledgment */
export interface GeminiSetupComplete {
  setupComplete: Record<string, never>;
}

/** Model response (audio + text) */
export interface GeminiServerContent {
  serverContent: {
    modelTurn?: {
      parts: GeminiPart[];
    };
    turnComplete?: boolean;
    interrupted?: boolean;
  };
}

export interface GeminiPart {
  text?: string;
  inlineData?: {
    mimeType: string;
    data: string; // base64 audio PCM 24kHz
  };
}

/** Tool call request from model */
export interface GeminiToolCallMessage {
  toolCall: {
    functionCalls: Array<{
      id: string;
      name: string;
      args: Record<string, unknown>;
    }>;
  };
}

/** Tool call cancellation */
export interface GeminiToolCallCancellation {
  toolCallCancellation: {
    ids: string[];
  };
}

/** Disconnect notice */
export interface GeminiGoAway {
  goAway: {
    timeLeft?: string;
  };
}

// ============================================================================
// Union types for message handling
// ============================================================================

export type GeminiClientMessage =
  | GeminiSetupMessage
  | GeminiRealtimeInput
  | GeminiClientContent
  | GeminiToolResponse;

export type GeminiServerMessage =
  | GeminiSetupComplete
  | GeminiServerContent
  | GeminiToolCallMessage
  | GeminiToolCallCancellation
  | GeminiGoAway;
