/**
 * Grok Types - xAI Voice Agent API types and configurations
 *
 * OpenAI Realtime API-compatible protocol.
 * Endpoint: wss://api.x.ai/v1/realtime
 * Input/Output: PCM 24kHz 16-bit (or native G.711 mu-law 8kHz for Twilio)
 */

// Available xAI voices
export type GrokVoice = "Ara" | "Rex" | "Sal" | "Eve" | "Leo";

// Audio format for xAI's nested audio config (differs from OpenAI's flat format)
export interface GrokAudioFormat {
  type: "audio/pcm" | "audio/pcmu" | "audio/pcma";
  rate: number;
}

// xAI session.update audio config (nested, unlike OpenAI's flat input_audio_format)
export interface GrokSessionAudioConfig {
  input: { format: GrokAudioFormat };
  output: { format: GrokAudioFormat };
}

// Native mu-law: skip all transcoding when going through Twilio (8kHz mu-law both sides)
export const GROK_NATIVE_MULAW_FORMAT: GrokAudioFormat = {
  type: "audio/pcmu",
  rate: 8000,
};

// Audio constants
export const GROK_DEFAULT_SAMPLE_RATE = 8000; // Native mu-law for Twilio passthrough

// xAI-specific event names that differ from OpenAI
export const GROK_EVENTS = {
  // These differ from OpenAI's naming convention
  AUDIO_DELTA: "response.output_audio.delta",
  AUDIO_DONE: "response.output_audio.done",
  TRANSCRIPT_DELTA: "response.output_audio_transcript.delta",
  TRANSCRIPT_DONE: "response.output_audio_transcript.done",
  // These are the same as OpenAI
  SPEECH_STARTED: "input_audio_buffer.speech_started",
  SPEECH_STOPPED: "input_audio_buffer.speech_stopped",
  FUNCTION_CALL_DONE: "response.function_call_arguments.done",
  RESPONSE_CREATED: "response.created",
  RESPONSE_DONE: "response.done",
} as const;
