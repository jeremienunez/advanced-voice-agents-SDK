/**
 * Event Types - All events emitted/consumed by the agent system
 */

// Channel type used across events
export type Channel = "voice" | "sms" | "chat";

// Base event interface
export interface BaseEvent {
  type: string;
  timestamp: number;
  sessionId: string;
  metadata?: Record<string, unknown>;
}

// Session Events
export interface SessionCreatedEvent extends BaseEvent {
  type: "session.created";
  userId: string;
  channel: Channel;
  tier: string;
}

export interface SessionEndedEvent extends BaseEvent {
  type: "session.ended";
  reason: "completed" | "timeout" | "error" | "user_hangup" | "quota_exceeded";
  durationMs: number;
}

export interface SessionErrorEvent extends BaseEvent {
  type: "session.error";
  error: { code: string; message: string; recoverable: boolean };
}

// Transport Events
export interface TransportConnectedEvent extends BaseEvent {
  type: "transport.connected";
  transportType: "twilio-voice" | "twilio-sms" | "openai-realtime";
}

export interface TransportDisconnectedEvent extends BaseEvent {
  type: "transport.disconnected";
  reason: "normal" | "error" | "timeout";
}

export interface TransportErrorEvent extends BaseEvent {
  type: "transport.error";
  error: { code: string; message: string };
}

// Audio Events (Voice)
export interface AudioReceivedEvent extends BaseEvent {
  type: "audio.received";
  source: "user" | "assistant";
  durationMs: number;
}

export interface AudioSentEvent extends BaseEvent {
  type: "audio.sent";
  destination: "user" | "model";
  durationMs: number;
}

export interface AudioPlaybackEvent extends BaseEvent {
  type:
    | "audio.playback_started"
    | "audio.playback_completed"
    | "audio.playback_interrupted";
  responseId: string;
}

// Speech Events
export interface SpeechEvent extends BaseEvent {
  type: "speech.started" | "speech.ended";
  speaker: "user" | "assistant";
}

export interface TranscriptEvent extends BaseEvent {
  type: "transcript.received";
  text: string;
  isFinal: boolean;
}

// SMS Events
export interface SmsReceivedEvent extends BaseEvent {
  type: "sms.received";
  from: string;
  body: string;
}

export interface SmsSentEvent extends BaseEvent {
  type: "sms.sent";
  to: string;
  body: string;
  segmentCount: number;
}

// Tool Events
export interface ToolCallStartedEvent extends BaseEvent {
  type: "tool.call_started";
  toolName: string;
  callId: string;
}

export interface ToolCallCompletedEvent extends BaseEvent {
  type: "tool.call_completed";
  toolName: string;
  callId: string;
  durationMs: number;
}

export interface ToolCallFailedEvent extends BaseEvent {
  type: "tool.call_failed";
  toolName: string;
  callId: string;
  error: { code: string; message: string };
}

// Auth Events
export interface AuthEvent extends BaseEvent {
  type: "auth.required" | "auth.success" | "auth.failed";
  userId?: string;
  attempt?: number;
}

// Barge-in Event
export interface BargeInEvent extends BaseEvent {
  type: "barge_in.detected";
  interruptedResponseId?: string;
}

// Union of all events
export type AgentEvent =
  | SessionCreatedEvent
  | SessionEndedEvent
  | SessionErrorEvent
  | TransportConnectedEvent
  | TransportDisconnectedEvent
  | TransportErrorEvent
  | AudioReceivedEvent
  | AudioSentEvent
  | AudioPlaybackEvent
  | SpeechEvent
  | TranscriptEvent
  | SmsReceivedEvent
  | SmsSentEvent
  | ToolCallStartedEvent
  | ToolCallCompletedEvent
  | ToolCallFailedEvent
  | AuthEvent
  | BargeInEvent;

export type AgentEventType = AgentEvent["type"];

// Helper to create events
export function createEvent<T extends AgentEvent>(
  type: T["type"],
  sessionId: string,
  data: Omit<T, "type" | "timestamp" | "sessionId">,
): T {
  return { type, timestamp: Date.now(), sessionId, ...data } as T;
}
