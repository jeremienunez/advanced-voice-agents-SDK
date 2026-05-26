/**
 * OpenAI Types - Realtime API (GA) types and configurations
 */

// Voice options for audio output
export type OpenAIVoice =
  | "alloy"
  | "ash"
  | "ballad"
  | "coral"
  | "echo"
  | "sage"
  | "shimmer"
  | "verse"
  | "marin"
  | "cedar";

// Model identifiers
export type OpenAIRealtimeModel =
  | "gpt-realtime-2"
  | "gpt-realtime-2025-08-28"
  | "gpt-realtime-mini"
  | "gpt-realtime-1.5";

export type OpenAIRealtimeReasoningEffort =
  | "minimal"
  | "low"
  | "medium"
  | "high"
  | "xhigh";

export type OpenAIRealtimeReasoningSetting =
  | "default"
  | OpenAIRealtimeReasoningEffort;

// Audio format config
export interface AudioFormatConfig {
  type: "audio/pcm";
  rate: number; // 24000 for OpenAI
}

// Turn detection config (VAD)
export interface TurnDetectionConfig {
  type: "server_vad" | "semantic_vad" | "none";
  threshold?: number; // 0-1
  prefix_padding_ms?: number;
  silence_duration_ms?: number;
  create_response?: boolean;
  interrupt_response?: boolean;
  eagerness?: "low" | "medium" | "high" | "auto"; // semantic_vad only
}

// Audio input config
export interface AudioInputConfig {
  format?: AudioFormatConfig;
  transcription?: { model: string };
  noise_reduction?: "near_field" | "far_field" | null;
  turn_detection?: TurnDetectionConfig;
}

// Audio output config
export interface AudioOutputConfig {
  format?: AudioFormatConfig;
  voice?: OpenAIVoice;
  speed?: number; // 0.25-1.5
}

// Tool definition for function calling
export interface OpenAITool {
  type: "function";
  name: string;
  description: string;
  parameters: Record<string, unknown>; // JSON Schema
}

// Session config (GA API format)
export interface OpenAISessionConfig {
  type: "realtime";
  model: OpenAIRealtimeModel;
  output_modalities: ("text" | "audio")[];
  instructions?: string;
  tools?: OpenAITool[];
  tool_choice?: "auto" | "none" | "required";
  audio?: {
    input?: AudioInputConfig;
    output?: AudioOutputConfig;
  };
  reasoning?: {
    effort: OpenAIRealtimeReasoningEffort;
  };
  max_output_tokens?: number | "inf";
  truncation?: "auto" | "disabled";
}

// Function call from OpenAI
export interface OpenAIFunctionCall {
  call_id: string;
  name: string;
  arguments: string; // JSON string
}

// Response create options (for instructions override)
export interface ResponseCreateOptions {
  instructions?: string;
  modalities?: ("text" | "audio")[];
  voice?: OpenAIVoice;
  speed?: number; // 0.25-1.5
  temperature?: number;
  max_response_output_tokens?: number | "inf";
}

// Server event types (OpenAI -> Client)
export type OpenAIServerEventType =
  | "session.created"
  | "session.updated"
  | "input_audio_buffer.committed"
  | "input_audio_buffer.speech_started"
  | "input_audio_buffer.speech_stopped"
  | "conversation.item.added"
  | "conversation.item.done"
  | "conversation.item.input_audio_transcription.completed"
  | "response.created"
  | "response.done"
  | "response.cancelled"
  | "response.output_item.added"
  | "response.output_item.done"
  | "response.text.delta"
  | "response.text.done"
  | "response.output_text.delta"
  | "response.output_text.done"
  | "response.audio.delta"
  | "response.audio.done" // Legacy
  | "response.output_audio.delta"
  | "response.output_audio.done"
  | "response.output_audio_transcript.delta"
  | "response.output_audio_transcript.done"
  | "response.function_call_arguments.delta"
  | "response.function_call_arguments.done"
  | "rate_limits.updated"
  | "error";

// Client event types (Client -> OpenAI)
export type OpenAIClientEventType =
  | "session.update"
  | "input_audio_buffer.append"
  | "input_audio_buffer.commit"
  | "input_audio_buffer.clear"
  | "conversation.item.create"
  | "conversation.item.truncate"
  | "conversation.item.delete"
  | "response.create"
  | "response.cancel";

// OpenAI error structure (nested format from Realtime API error events)
export interface OpenAIApiError {
  type: "error";
  error: {
    type: string;
    code?: string;
    message: string;
    param?: string;
  };
}

// Server event base structure
export interface OpenAIServerEvent {
  type: OpenAIServerEventType;
  event_id?: string;
  [key: string]: unknown;
}

// Audio delta event
export interface AudioDeltaEvent extends OpenAIServerEvent {
  type: "response.output_audio.delta";
  response_id: string;
  item_id: string;
  output_index: number;
  content_index: number;
  delta: string; // base64 audio
}

// Function call done event
export interface FunctionCallDoneEvent extends OpenAIServerEvent {
  type: "response.function_call_arguments.done";
  response_id: string;
  item_id: string;
  output_index: number;
  call_id: string;
  name: string;
  arguments: string;
}
