/**
 * Twilio Types - Voice and SMS API types
 */

// Call status
export type TwilioCallStatus =
  | "queued"
  | "ringing"
  | "in-progress"
  | "completed"
  | "busy"
  | "failed"
  | "no-answer"
  | "canceled";

// Stream event types
export type TwilioStreamEvent =
  | "connected"
  | "start"
  | "media"
  | "dtmf"
  | "stop"
  | "mark";

// Media message (audio data)
export interface TwilioMediaMessage {
  event: "media";
  sequenceNumber: string;
  media: {
    track: "inbound" | "outbound";
    chunk: string;
    timestamp: string;
    payload: string;
  };
  streamSid: string;
}

// Start message (call initiated)
export interface TwilioStartMessage {
  event: "start";
  sequenceNumber: string;
  start: {
    streamSid: string;
    accountSid: string;
    callSid: string;
    tracks: ("inbound" | "outbound")[];
    customParameters?: Record<string, string>;
    mediaFormat: { encoding: string; sampleRate: number; channels: number };
  };
  streamSid: string;
}

// DTMF message (key press)
export interface TwilioDtmfMessage {
  event: "dtmf";
  sequenceNumber: string;
  dtmf: { digit: string; duration?: number };
  streamSid: string;
}

// Stop message
export interface TwilioStopMessage {
  event: "stop";
  sequenceNumber: string;
  stop: { accountSid: string; callSid: string };
  streamSid: string;
}

// Connected message
export interface TwilioConnectedMessage {
  event: "connected";
  protocol: string;
  version: string;
}

// Mark message (sync acknowledgment)
export interface TwilioMarkMessage {
  event: "mark";
  sequenceNumber: string;
  mark: { name: string };
  streamSid: string;
}

// Union of all stream messages
export type TwilioStreamMessage =
  | TwilioConnectedMessage
  | TwilioStartMessage
  | TwilioMediaMessage
  | TwilioDtmfMessage
  | TwilioStopMessage
  | TwilioMarkMessage;

// Outbound audio command
export interface TwilioOutboundAudio {
  event: "media";
  streamSid: string;
  media: { payload: string };
}

// Voice webhook payload
export interface TwilioVoiceWebhook {
  CallSid: string;
  AccountSid: string;
  From: string;
  To: string;
  CallStatus: TwilioCallStatus;
  Direction: "inbound" | "outbound-api" | "outbound-dial";
  ForwardedFrom?: string;
  CallerName?: string;
}

// SMS Status
export type SmsStatus =
  | "accepted"
  | "queued"
  | "sending"
  | "sent"
  | "delivered"
  | "undelivered"
  | "failed"
  | "received";

// SMS Commands (parsed from user message)
export type SmsCommand =
  | "HELP"
  | "MATCH"
  | "COLLECTION"
  | "CONSUME"
  | "STOP"
  | "YES"
  | "NO"
  | "UNKNOWN";

// Parsed SMS message
export interface SmsParsedMessage {
  command: SmsCommand;
  rawText: string;
  extractedSubject?: string;
  extractedItem?: string;
  isGreeting?: boolean;
  isQuestion?: boolean;
  confidence: number;
}

// SMS inbound webhook (Twilio)
export interface SmsInboundWebhook {
  MessageSid: string;
  AccountSid: string;
  From: string;
  To: string;
  Body: string;
  NumMedia: string;
  NumSegments: string;
  MessagingServiceSid?: string;
}

// SMS status webhook
export interface SmsStatusWebhook {
  MessageSid: string;
  AccountSid: string;
  From: string;
  To: string;
  MessageStatus: SmsStatus;
  ErrorCode?: string;
  ErrorMessage?: string;
}

// SMS outbound message
export interface SmsOutboundMessage {
  to: string;
  from: string;
  body: string;
  statusCallback?: string;
  messagingServiceSid?: string;
}

// SMS response format
export interface SmsResponseFormat {
  segments: string[];
  totalLength: number;
  segmentCount: number;
}
