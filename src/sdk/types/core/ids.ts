export type AgentChannel = "voice" | "chat" | "sms";

export type ProviderKind =
  | "openai-realtime"
  | "gemini-live"
  | "grok-realtime"
  | "cascaded"
  | "custom";

export type MediaBridgeKind =
  | "twilio-voice"
  | "browser-websocket"
  | "sip"
  | "custom";

export type PlanId = string;
export type ToolName = string;
export type TenantId = string;
export type ProviderId = string;
export type DatabaseResourceId = string;
