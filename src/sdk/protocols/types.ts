import type { JsonSchema, JsonValue } from "../types/json.js";

export type McpTransportKind = "stdio" | "streamable-http";
export type A2ABindingKind = "json-rpc-http" | "http-json-rest" | "grpc";

export interface McpCompatibilityProfile {
  protocolVersion: string;
  transports: readonly McpTransportKind[];
}

export interface A2ACompatibilityProfile {
  protocolVersion: string;
  bindings: readonly A2ABindingKind[];
}

export interface ProtocolCompatibilityProfile {
  mcp?: McpCompatibilityProfile;
  a2a?: A2ACompatibilityProfile;
}

export interface McpToolAnnotations {
  readOnlyHint?: boolean;
  destructiveHint?: boolean;
  idempotentHint?: boolean;
  openWorldHint?: boolean;
  requiresConfirmation?: boolean;
  sideEffect?: string;
  executionMode?: string;
  maxCallsPerSession?: number;
  timeoutMs?: number;
}

export interface McpToolDescriptor {
  name: string;
  title?: string;
  description?: string;
  inputSchema: JsonSchema;
  outputSchema?: JsonSchema;
  annotations?: McpToolAnnotations;
  metadata?: Record<string, JsonValue>;
}

export type A2ATaskState =
  | "TASK_STATE_SUBMITTED"
  | "TASK_STATE_WORKING"
  | "TASK_STATE_INPUT_REQUIRED"
  | "TASK_STATE_AUTH_REQUIRED"
  | "TASK_STATE_COMPLETED"
  | "TASK_STATE_CANCELED"
  | "TASK_STATE_REJECTED"
  | "TASK_STATE_FAILED";

export interface A2AAgentCapabilities {
  streaming?: boolean;
  pushNotifications?: boolean;
  stateTransitionHistory?: boolean;
  extendedAgentCard?: boolean;
}

export interface A2AAgentSkill {
  id: string;
  name: string;
  description?: string;
  tags?: readonly string[];
  examples?: readonly string[];
  inputModes?: readonly string[];
  outputModes?: readonly string[];
}

export type A2AProtocolBinding = "JSONRPC" | "HTTP+JSON" | "GRPC";

export interface A2ASupportedInterface {
  url: string;
  protocolBinding: A2AProtocolBinding;
  protocolVersion: string;
}

export interface A2AAgentCard {
  name: string;
  description: string;
  url: string;
  version: string;
  protocolVersion: string;
  supportedInterfaces?: readonly A2ASupportedInterface[];
  capabilities: A2AAgentCapabilities;
  defaultInputModes?: readonly string[];
  defaultOutputModes?: readonly string[];
  skills: readonly A2AAgentSkill[];
  provider?: {
    organization: string;
    url?: string;
  };
  securitySchemes?: Record<string, unknown>;
  security?: Array<Record<string, readonly string[]>>;
  metadata?: Record<string, JsonValue>;
}

export type A2APart =
  | { text: string; metadata?: Record<string, JsonValue> }
  | { data: JsonValue; mediaType?: string; metadata?: Record<string, JsonValue> }
  | {
    raw: string;
    filename?: string;
    mediaType?: string;
    metadata?: Record<string, JsonValue>;
  }
  | {
    url: string;
    filename?: string;
    mediaType?: string;
    metadata?: Record<string, JsonValue>;
  };

export type A2ARole = "ROLE_USER" | "ROLE_AGENT";

export interface A2AMessage {
  role: A2ARole;
  messageId: string;
  parts: readonly A2APart[];
  contextId?: string;
  taskId?: string;
  referenceTaskIds?: readonly string[];
  metadata?: Record<string, JsonValue>;
}

export interface A2AArtifact {
  artifactId: string;
  name?: string;
  description?: string;
  parts: readonly A2APart[];
  metadata?: Record<string, JsonValue>;
}

export interface A2ATask {
  id: string;
  contextId?: string;
  status: {
    state: A2ATaskState;
    timestamp: string;
    message?: A2AMessage;
  };
  artifacts?: readonly A2AArtifact[];
  history?: readonly A2AMessage[];
  metadata?: Record<string, JsonValue>;
}
